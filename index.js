const express = require('express');
const fs = require('fs');
const path = require('path');
const fileUpload = require('express-fileupload'); // File upload middleware
const app = express();

const FOLDERS_PATH = path.join(__dirname, 'folders');
const MAX_FOLDERS = 3;

// Middleware
app.use(express.static(FOLDERS_PATH));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(fileUpload()); // Enable file upload

// Create folders directory if it doesn't exist
if (!fs.existsSync(FOLDERS_PATH)) {
    fs.mkdirSync(FOLDERS_PATH);
}

// Function to create a new folder with the current timestamp
function createNewFolder() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folderPath = path.join(FOLDERS_PATH, timestamp);

    fs.mkdirSync(folderPath);
    console.log(`Created folder: ${folderPath}`);

    // Delete the oldest folder if the number of folders exceeds the limit
    const folders = fs.readdirSync(FOLDERS_PATH).sort((a, b) => {
        return fs.statSync(path.join(FOLDERS_PATH, a)).ctime - fs.statSync(path.join(FOLDERS_PATH, b)).ctime;
    });

    if (folders.length > MAX_FOLDERS) {
        const oldestFolder = folders[0];
        fs.rmSync(path.join(FOLDERS_PATH, oldestFolder), { recursive: true, force: true });
        console.log(`Deleted oldest folder: ${oldestFolder}`);
    }
}

// Set up a timer to create a folder every minute
setInterval(createNewFolder, 60000);

// Format timestamp function
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const yil = date.getFullYear();
    const oy = String(date.getMonth() + 1).padStart(2, '0');
    const kun = String(date.getDate()).padStart(2, '0');
    const soat = String(date.getHours()).padStart(2, '0');
    const minut = String(date.getMinutes()).padStart(2, '0');
    const sekund = String(date.getSeconds()).padStart(2, '0');
    return `${kun}-${oy}-${yil} ${soat}:${minut}:${sekund}`;
}

// Serve index.html with a list of folders
app.get('/', (req, res) => {
    const folders = fs.readdirSync(FOLDERS_PATH)
        .map(folder => {
            const folderPath = path.join(FOLDERS_PATH, folder);
            const createdTime = fs.statSync(folderPath).ctime;
            return `<li> <a href="/folders/${folder}">${formatTimestamp(createdTime)}</a></li>`;
        })
        .join('');

    res.send(`
        <html>
            <body>
                <h1>Folders</h1>
                <ul>${folders}</ul>
                <form action="/upload" method="post" enctype="multipart/form-data">
                    <h2>Upload a File</h2>
                    <input type="file" name="file" />
                    <button type="submit">Upload</button>
                </form>
            </body>
        </html>
    `);
});

// File upload route
app.post('/upload', (req, res) => {
    const file = req.files?.file;

    if (!file) {
        return res.status(400).send('File is required.');
    }

    // Get the latest created folder
    const folders = fs.readdirSync(FOLDERS_PATH).sort((a, b) => {
        return fs.statSync(path.join(FOLDERS_PATH, b)).ctime - fs.statSync(path.join(FOLDERS_PATH, a)).ctime;
    });

    if (folders.length === 0) {
        return res.status(404).send('No folders available to upload.');
    }

    const latestFolder = folders[0];
    const folderPath = path.join(FOLDERS_PATH, latestFolder);

    // Generate a timestamp for the file name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // Current timestamp
    const fileNameWithTimestamp = `${timestamp}-${file.name}`; // Append timestamp to file name

    const filePath = path.join(folderPath, fileNameWithTimestamp);

    // Move the file to the latest folder with the new name
    file.mv(filePath, err => {
        if (err) {
            console.error(err);
            return res.status(500).send('Failed to upload file.');
        }
        res.send(`File uploaded successfully to folder: ${latestFolder} with name: ${fileNameWithTimestamp}`);
    });
});


// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
