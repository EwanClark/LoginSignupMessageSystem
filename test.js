const fs = require('fs');
const path = require('path');

// Function to read hate words from filter.txt
function getHateWordsFromFile(filePath) {
    try {
        // Read the file synchronously and split it by new lines to create an array
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return fileContent.split('\n').map(word => word.trim()).filter(Boolean); // Removes empty lines
    } catch (error) {
        console.error('Error reading file:', error);
        return [];
    }
}

// Function to check if a string contains any hate speech
function containsHateSpeech(text, hateWords) {
    const lowerCaseText = text.toLowerCase();
    return hateWords.some(hateWord => lowerCaseText.includes(hateWord.toLowerCase()));
}

// Example usage
const filePath = path.join(__dirname, 'filter.txt'); // Assuming the file is in the same directory
const hateWords = getHateWordsFromFile(filePath); // Load the hate words from the file

const text = "This is an example string with offensiveWord1 in it."; // Example string to check
const result = containsHateSpeech(text, hateWords);

console.log('Contains hate speech:', result);  // true if hate word is found, otherwise false
