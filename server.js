const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fileUpload = require('express-fileupload');
const moment = require('moment');
const bodyParser = require('body-parser');

const { requiresAuth } = require('express-openid-connect');
const { auth } = require('express-openid-connect');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(fileUpload());

const config = {
  authRequired: false,
  auth0Logout: true,
  secret: process.env.SECRET || 'a long, randomly-generated string stored in env',
  baseURL: process.env.BASE_URL || 'http://localhost:3000',
  clientID: process.env.CLIENT_ID || 'yT2he6zIWN8rXoC2YouxeA0WrpLp0KL1',
  issuerBaseURL: process.env.ISSUER_BASE_URL || 'https://dev-xuenlyj535dnppsd.us.auth0.com'
};

app.use(auth(config));

// Middleware to protect specific static files
app.use((req, res, next) => {
    const protectedPaths = ['/admin.html', '/admin_entries.html'];
    if (protectedPaths.includes(req.path) && (!req.oidc.isAuthenticated() || req.oidc.user.nickname !== 'antons.cernavskis')) {
        return res.status(403).send('Access Forbidden');
    }
    next();
});

app.get('/entries.html', requiresAuth(), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'entries.html'));
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/files', async (req, res) => {
    try {
        const filesDirectory = path.join(__dirname, 'public', 'files');
        const files = await fs.readdir(filesDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading files directory:', err);
        res.status(500).send('Unable to scan files directory');
    }
});

app.get('/files/:eventName', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'files', eventName);
        const files = await fs.readdir(eventDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading event directory:', err);
        res.status(500).send('Unable to scan event directory');
    }
});

app.post('/create-folder_entrySys', async (req, res) => {
    const { date, name, path: basePath } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', basePath, folderName);

    try {
        await fs.mkdir(folderPath, { recursive: true });

        const registrationStartDate = moment().format();
        const registrationEndDate = moment(date, 'YYYY-MM-DD').subtract(2, 'days').set({ hour: 20, minute: 59, second: 59 }).format();
        const entryPath = path.join(folderPath, 'entries.json');
        const configPath = path.join(folderPath, 'config.json');
        const defaultConfig = {
            organizations: [
                "MSĢ TSV SASS",
                "MSĢ TSV Jūrmala",
                "Daugavpils Sporta skola",
                "Jelgavas BJSS",
                "LATC",
                "Rīgas Airētāju klubs",
                "Lielupes airēšanas klubs",
                "Airusports",
                "Other"
            ],
            boatClasses: [
                { class: "Select" },
                { class: "M1x", participants: 1 },
                { class: "W1x", participants: 1 },
                { class: "M2x", participants: 2 },
                { class: "W2x", participants: 2 },
                { class: "M2-", participants: 2 },
                { class: "W2-", participants: 2 },
                { class: "M4x", participants: 4 },
                { class: "W4x", participants: 4 },
                { class: "M4-", participants: 4 },
                { class: "W4-", participants: 4 },
                { class: "M8+", participants: 9, coxswainIndex: 8, coxswainName: "Sturmanis" },
                { class: "W8+", participants: 9, coxswainIndex: 8, coxswainName: "Sturmanis" }
            ],
            registrationStartDate: registrationStartDate,
            registrationEndDate: registrationEndDate
        };

        await fs.writeFile(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');

        res.status(200).send('Folder and config.json created successfully');
    } catch (err) {
        console.error('Error creating folder or config.json:', err);
        res.status(500).send('Failed to create folder or config.json');
    }
});

app.post('/delete-folder_entrySys', async (req, res) => {
    const { date, name } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', 'entrySys', folderName);

    try {
        await fs.rmdir(folderPath, { recursive: true });
        res.status(200).send('Folder deleted successfully');
    } catch (err) {
        console.error('Error deleting folder:', err);
        res.status(500).send('Failed to delete folder');
    }
});

app.post('/upload-file', requiresAuth(), async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        const { eventDate, eventName } = req.body;
        const eventFolder = `${eventDate}  ${eventName}`;
        const uploadDir = path.join(__dirname, 'public', 'files', eventFolder);

        await fs.mkdir(uploadDir, { recursive: true });

        const uploadedFile = req.files.file;
        const filePath = path.join(uploadDir, uploadedFile.name);

        await uploadedFile.mv(filePath);

        res.status(200).send('File uploaded successfully');
    } catch (err) {
        console.error('Error uploading file:', err);
        res.status(500).send('Failed to upload file');
    }
});

app.delete('/delete-file/:eventName/:fileName', requiresAuth(), async (req, res) => {
    try {
        const { eventName, fileName } = req.params;
        const eventDirectory = path.join(__dirname, 'public', 'files', eventName);
        const filePath = path.join(eventDirectory, fileName);

        await fs.unlink(filePath);
        res.status(200).send('File deleted successfully');
    } catch (err) {
        console.error('Error deleting file:', err);
        res.status(500).send('Failed to delete file');
    }
});

app.get('/entrySys', async (req, res) => {
    try {
        const entrySysDirectory = path.join(__dirname, 'public', 'entrySys');
        const files = await fs.readdir(entrySysDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading entrySys directory:', err);
        res.status(500).send('Unable to scan entrySys directory');
    }
});

app.get('/entrySys/:eventName', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventName);
        const files = await fs.readdir(eventDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading entrySys event directory:', err);
        res.status(500).send('Unable to scan entrySys event directory');
    }
});

app.get('/entrySys/:eventName/config.json', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const configPath = path.join(__dirname, 'public', 'entrySys', eventName, 'config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        res.json(JSON.parse(configData));
    } catch (err) {
        console.error('Error reading config.json:', err);
        res.status(500).send('Unable to read config.json');
    }
});

app.put('/entrySys/:eventName/config.json', requiresAuth(), async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const configPath =  path.join(__dirname, 'public', 'entrySys', eventName, 'config.json');
        const configData = JSON.stringify(req.body, null, 2);
        await fs.writeFile(configPath, configData, 'utf8');
        res.status(200).send('Config.json saved successfully');
    } catch (err) {
        console.error('Error saving config.json:', err);
        res.status(500).send('Unable to save config.json');
    }
});

app.delete('/entrySys/:eventName', requiresAuth(), async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventName);
        await fs.rmdir(eventDirectory, { recursive: true });
        res.status(200).send('Event folder deleted successfully');
    } catch (err) {
        console.error('Error deleting event folder:', err);
        res.status(500).send('Failed to delete event folder');
    }
});

app.post('/create-folder', async (req, res) => {
    const { date, name } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', 'files', folderName);

    try {
        await fs.mkdir(folderPath, { recursive: true });

        res.status(200).send('Folder created successfully');
    } catch (err) {
        console.error('Error creating folder:', err);
        res.status(500).send('Failed to create folder');
    }
});

app.post('/delete-folder', async (req, res) => {
    const { date, name } = req.body;
    const folderName = `${date}  ${name}`;
    const folderPath = path.join(__dirname, 'public', 'files', folderName);

    try {
        await fs.rmdir(folderPath, { recursive: true });
        res.status(200).send('Folder deleted successfully');
    } catch (err) {
        console.error('Error deleting folder:', err);
        res.status(500).send('Failed to delete folder');
    }
});

app.get('/profile', requiresAuth(), (req, res) => {
    res.send(JSON.stringify(req.oidc.user));
});

// Serve admin.html (protected route)
app.get('/admin', requiresAuth(), (req, res) => {
    const nickname = req.oidc.user.nickname;
    if (nickname === 'antons.cernavskis') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.redirect('/'); // Redirect to index.html if the user's nickname is not 'antons.cernavskis'
    }
});

// Prevent direct access to admin.html
app.get('/admin.html', requiresAuth(), (req, res) => {
    const nickname = req.oidc.user.nickname;
    if (nickname === 'antons.cernavskis') {
        res.sendFile(path.join(__dirname, 'public', 'admin.html'));
    } else {
        res.status(403).send('Access Forbidden'); // Send forbidden status if the user is not authorized
    }
});

// Route to list files in a directory
app.get('/files', requiresAuth(), async (req, res) => {
    try {
        const filesDirectory = path.join(__dirname, 'public', 'files');
        const files = await fs.readdir(filesDirectory);
        res.json(files);
    } catch (err) {
        console.error('Error reading files directory:', err);
        res.status(500).send('Unable to scan files directory');
    }
});

app.get('/logout', (req, res) => {
    res.oidc.logout();
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

