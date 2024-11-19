const express = require('express');
require('dotenv').config();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse'); // For parsing PDF files
const { GoogleGenerativeAI } = require("@google/generative-ai"); // Gemini API client

const app = express();
const genAI = new GoogleGenerativeAI(process.env.API_KEY); // Replace with your API key

// Set up storage for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads'),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage: storage });

// Function to convert PDF to text format
async function parsePDF(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    return data.text;
}

// Send question and data to Gemini API
async function queryGemini(data, question) {
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    const result = await model.generateContent([question, data]);
    const response = await result.response;
    return response.text();
}

// Handle upload requests
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
        const question = req.body.question;
        let fileData;

        // Check if file is a PDF
        if (req.file.mimetype === 'application/pdf') {
            fileData = await parsePDF(req.file.path);
        } else {
            return res.status(400).json({ error: 'Only PDF files are supported' });
        }

        const answer = await queryGemini(fileData, question);
        res.json({ answer });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to process request' });
    } finally {
        fs.unlinkSync(req.file.path); // Remove uploaded file after processing
    }
});

// Serve the HTML file
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));