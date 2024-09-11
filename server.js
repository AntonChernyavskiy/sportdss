const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const fileUpload = require('express-fileupload');
const moment = require('moment');
const etag = require('etag');
const bodyParser = require('body-parser');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(fileUpload());

const version = Date.now();

app.get('/server-time', (req, res) => {
    res.json({ utcTime: new Date().toISOString() });
});

app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    if (req.url.startsWith('/public/')) {
        req.url = `${req.url}?v=${version}`;
    }
    next();
}, express.static(path.join(__dirname, 'public'), {
    etag: false,
    setHeaders: (res, path) => {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('ETag', etag(path));
    }
}));

// Get list of files in the files directory
app.get('/files', async (req, res) => {
    try {
        const filesDirectory = path.join(__dirname, 'public', 'files');
        const files = await fs.readdir(filesDirectory);
        res.json(files);
    } catch (err) {
        // console.error('Error reading files directory:', err);
        // res.status(500).send('Unable to scan files directory');
    }
});

// Get list of files in a specific event directory
app.get('/files/:eventName', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'files', eventName);

        const baseFiles = await fs.readdir(eventDirectory);
        const resultsDirectory = path.join(eventDirectory, 'Results');
        const startlistsDirectory = path.join(eventDirectory, 'Startlists');

        const resultsFiles = await fs.readdir(resultsDirectory).catch(() => []);
        const startlistsFiles = await fs.readdir(startlistsDirectory).catch(() => []);

        res.json({
            baseFiles: baseFiles.filter(file => file !== 'Results' && file !== 'Startlists'),
            resultsFiles,
            startlistsFiles
        });
    } catch (err) {
        // console.error('Error reading event directory:', err);
        // res.status(500).send('Unable to scan event directory');
    }
});

// List files in the entrySys directory
app.get('/entrySys', async (req, res) => {
    try {
        const entrySysDirectory = path.join(__dirname, 'public', 'entrySys');
        const files = await fs.readdir(entrySysDirectory);
        res.json(files);
    } catch (err) {
        // console.error('Error reading entrySys directory:', err);
        // res.status(500).send('Unable to scan entrySys directory');
    }
});

// List files in a specific event directory within entrySys
app.get('/entrySys/:eventName', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventName);
        const files = await fs.readdir(eventDirectory);
        res.json(files);
    } catch (err) {
        // console.error('Error reading entrySys event directory:', err);
        // res.status(500).send('Unable to scan entrySys event directory');
    }
});

// Get config.json for a specific event
app.get('/entrySys/:eventName/config.json', async (req, res) => {
    try {
        const eventName = req.params.eventName;
        const configPath = path.join(__dirname, 'public', 'entrySys', eventName, 'config.json');
        const configData = await fs.readFile(configPath, 'utf8');
        res.json(JSON.parse(configData));
    } catch (err) {
        // console.error('Error reading config.json:', err);
        // res.status(500).send('Unable to read config.json');
    }
});

// Submit an entry
app.post('/submit-entry', async (req, res) => {
    try {
        const { eventDate, eventName, formData } = req.body;

        // Validate formData, eventName, and eventDate
        if (!formData || !eventName || !eventDate) {
            return res.status(400).send('formData, eventName, and eventDate are required');
        }

        // Validate formData structure
        if (!Array.isArray(formData.participants) || formData.participants.length === 0) {
            return res.status(400).send('Invalid formData: participants array is required');
        }

        // Format participants data for entries.csv
        const formattedParticipants = formData.participants.map(participant => {
            const { license, firstName, lastName, birthYear } = participant;
            let formattedName = 'ERROR-EMPTY';
            if (license) {
                formattedName = license;
            } else if (firstName && lastName && birthYear) {
                const surname = lastName.toUpperCase();
                const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
                const year = birthYear.slice(-2);
                const organization = participant.organization && participant.organization !== 'Other' ? participant.organization : participant.otherOrganization;
                formattedName = organization ? `${organization} / ${surname} ${name} ${year}` : `${surname} ${name} ${year}`;
            }
            return formattedName;
        }).join('<br>');
        
        const trimmedParticipants = formattedParticipants.trim(); // This is now a string

        const boatClass = formData.boatClass;
        const contactInformation = formData.contactInformation;
        const organization = formData.organization;
        const otherOrganization = formData.otherOrganization;

        // Extract and format coach information
        const coachInformation = (formData.coachInformation || '').toUpperCase().replace(/,/g, '<br>');

        // Get the current server time in YYYY-MM-DD HH:MM:SS format
        const now = new Date();
        const formattedDate = now.toISOString().replace('T', ' ').substring(0, 19); // YYYY-MM-DD HH:MM:SS

        // Prepare CSV data for entries.csv
        const csvData = `\n${boatClass},${organization && organization !== 'Other' ? organization : otherOrganization},${trimmedParticipants},${contactInformation},${coachInformation},${formattedDate}`;
        const eventFolder = `${eventDate}  ${eventName}`;
        const eventDirectory = path.join(__dirname, 'public', 'entrySys', eventFolder);
        const entriesFilePath = path.join(eventDirectory, 'entries.csv');

        // Ensure the directory exists, create if it doesn't
        await fs.mkdir(eventDirectory, { recursive: true });

        // Append data to entries.csv
        await fs.appendFile(entriesFilePath, csvData, 'utf8');

        // Prepare CSV data for participants.csv
        const participantsData = formData.participants.map(participant => {
            const { license, firstName, lastName, birthYear } = participant;
            let formattedName = 'ERROR-EMPTY';
            if (license) {
                formattedName = license;
            } else if (firstName && lastName && birthYear) {
                const surname = lastName.toUpperCase();
                const name = firstName.charAt(0).toUpperCase() + firstName.slice(1);
                const year = birthYear.slice(-2);
                const organization = participant.organization && participant.organization !== 'Other' ? participant.organization : participant.otherOrganization;
                formattedName = organization ? `${organization} / ${surname} ${name} ${year}` : `${surname} ${name} ${year}`;
            }
            return `${boatClass},${organization && organization !== 'Other' ? organization : otherOrganization},${formattedName}`;
        }).join('\n');

        const participantsFilePath = path.join(eventDirectory, 'participants.csv');

        // Append data to participants.csv
        await fs.appendFile(participantsFilePath, `\n${participantsData}`, 'utf8');

        // Respond with success message
        res.status(200).send('Entry submitted successfully!');
    } catch (error) {
        console.error('Error submitting entry:', error);
        res.status(500).send('Failed to submit entry');
    }
});

// app.use((req, res, next) => {
//     res.redirect('https://sportdss.eu/');
// });

app.use(bodyParser.urlencoded({ extended: true })); // Для обработки данных формы

// Маршрут для обработки данных опроса
app.post('/submit-survey', (req, res) => {
    const surveyResults = req.body;

    // Обработка результатов
    console.log('Ответы опроса:', surveyResults);

    // Здесь можно добавить логику сохранения данных в базу
    // Например, с использованием MongoDB или другой базы данных

    res.send('Данные опроса успешно получены');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});