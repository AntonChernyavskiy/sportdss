const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fileUpload = require('express-fileupload');
const moment = require('moment');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(fileUpload());


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

// удалить папку в заявках
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

// закинуть файл в заявки
app.post('/upload-file', async (req, res) => {
    try {
        if (!req.files || Object.keys(req.files).length === 0) {
            return res.status(400).send('No files were uploaded.');
        }

        const { eventDate, eventName } = req.body;
        const eventFolder = `${eventDate}  ${eventName}`;
        const uploadDir = path.join(__dirname, 'public', 'entrySys', eventFolder);

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

// удалить папку в заявках
app.delete('/delete-file/:eventName/:fileName', async (req, res) => {
    try {
        const { eventName, fileName } = req.params;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventName);
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

// сохранить конфиг файл в конкретном месте
app.put('/entrySys/:eventName/config.json', async (req, res) => {
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

// удалить папку в формах
app.delete('/entrySys/:eventName', async (req, res) => {
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

// новая папка в соревах
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

// удалить папку в соревах
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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});