let currentSpaceCount = 0;
let checkforlastword = false;
let lastwordcurrentlength = 0;
let spaceCount = 0;
let lastwordlength = 0;
let texttotest = "";
let expectedWords = [];
let startTime = null;
let correctWordsCount = 0;

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function startbuttonFunction() {
    texttotest = "erm excuse me what the flying sigma what the gyatt damm cheese is that";
    expectedWords = texttotest.trim().split(/\s+/); // Split words by spaces
    document.getElementById('text').innerHTML = highlightText(texttotest, ''); // Clear the display initially
    document.getElementById('text-input').value = '';
    document.getElementById('text-input').placeholder = '3...';
    await wait(1000);
    document.getElementById('text-input').placeholder = '2...';
    await wait(1000);
    document.getElementById('text-input').placeholder = '1...';
    await wait(1000);
    document.getElementById('text-input').placeholder = texttotest;
    document.getElementById('text-input').disabled = false;
    document.getElementById('text-input').focus();

    // Calculate space count and last word length
    lastwordlength = expectedWords[expectedWords.length - 1].length;
    spaceCount = (texttotest.match(/\s/g) || []).length;

    // Reset counters
    currentSpaceCount = 0;
    checkforlastword = false;
    lastwordcurrentlength = 0;
    correctWordsCount = 0;
    startTime = new Date(); // Record the start time

    // Reset the display with the full text
    document.getElementById('text').innerHTML = highlightText(texttotest, '');
}

function stopbuttonFunction() {
    document.getElementById('text-input').disabled = true;
    document.getElementById('wpm').innerText = 'n/a';
    document.getElementById('accuracy').innerText = 'n/a';
    document.getElementById('text-input').value = '';
    document.getElementById('text-input').placeholder = 'Press start to begin typing...';
}

function highlightText(fullText, typedText) {
    let highlighted = '';
    let typedWords = typedText.trim().split(/\s+/);
    let fullWords = fullText.split(/\s+/);

    for (let i = 0; i < fullWords.length; i++) {
        if (i < typedWords.length) {
            if (fullWords[i] === typedWords[i]) {
                highlighted += `<span style="color:green">${fullWords[i]}</span> `;
            } else {
                highlighted += `<span style="color:red">${fullWords[i]}</span> `;
            }
        } else {
            highlighted += fullWords[i] + ' ';
        }
    }
    return highlighted.trim();
}

function removeExtraSpaces(input) {
    return input.replace(/\s\s+/g, ' ');  // Remove consecutive spaces
}

function calculateWPM(startTime, endTime, wordCount) {
    const timeDiff = (endTime - startTime) / 1000 / 60; // Time difference in minutes
    return Math.round(wordCount / timeDiff);
}

function calculateAccuracy(correctWords, totalWords) {
    return Math.round((correctWords / totalWords) * 100);
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('text-input').disabled = true;
    document.getElementById('start').addEventListener('click', startbuttonFunction);
    document.getElementById('stop').addEventListener('click', stopbuttonFunction);

    document.getElementById('text-input').addEventListener('input', function () {
        let inputText = this.value;
        inputText = removeExtraSpaces(inputText); // Remove double spaces
        this.value = inputText;

        const words = inputText.trim().split(/\s+/);
        correctWordsCount = 0;

        for (let i = 0; i < words.length; i++) {
            if (words[i] === expectedWords[i]) {
                correctWordsCount++;
                console.log('Correct word:', words[i]);
            } else {
                console.log('Incorrect word:', words[i]);
            }
        }

        // Check if the entire text is typed correctly
        if (inputText.trim() === texttotest) {
            console.log('Finished typing the entire text!');
            const endTime = new Date(); // Record the end time
            const wpm = calculateWPM(startTime, endTime, expectedWords.length);
            const accuracy = calculateAccuracy(correctWordsCount, expectedWords.length);
            document.getElementById('wpm').innerText = wpm;
            document.getElementById('accuracy').innerText = accuracy + '%';
        }

        // Update the display box
        document.getElementById('text').innerHTML = highlightText(texttotest, inputText);
    });
});