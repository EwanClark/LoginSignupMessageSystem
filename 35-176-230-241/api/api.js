import express from "express";
import cors from "cors";
import mysql from "mysql2";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fetch from "node-fetch";
import dotenv from "dotenv";
import axios from 'axios';
import readline from 'readline';
import fs from 'fs';

const app = express();
dotenv.config();
const port = 4000;
const ip = process.env.IP;

// Rate limiter middleware
const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: "Too many requests from this IP, please try again after 1 minute",
});

app.set("trust proxy", 1);
app.use(
    cors({
        origin: "https://bubllz.com",
        methods: ["GET", "POST"],
        allowedHeaders: ["Content-Type", "Authorization", "token"],
    })
);


app.use(express.json());
app.use(limiter);
let messages = [];
let clients = [];
let hatewords = [];
let connection;
let shorturlfilter = true;
const excludedRoutes = [
    "/login",
    "/signup",
    "/message",
    "/poll",
    "/validurl",
    "/getshorturls",
    "/addshorturl",
    "/removeshorturl",
    "/getattrs",
];
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
if (!fs.existsSync('./settings.txt')) {
    fs.writeFileSync('./settings.txt', '');
    console.log('settings.txt created');
    console.log("Since this is your first time running the application, the shorturlfilter is set to true by default.");
    fs.writeFileSync('./settings.txt', `shorturlfilter=${shorturlfilter}`);
}

function handleDisconnect() {
    connection = mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_DATABASE,
        port: process.env.DB_PORT,
    });

    connection.connect((err) => {
        if (err) {
            console.error("Error connecting to database:", err);
            setTimeout(handleDisconnect, 2000); // Reconnect after 2 seconds
        } else {
            console.log("Connected to database");
        }
    });

    connection.on("error", (err) => {
        console.error("Database error:", err);
        if (err.code === "PROTOCOL_CONNECTION_LOST" || err.code === "ECONNRESET") {
            handleDisconnect(); // Reconnect on connection loss or reset
        } else {
            console.error("Unhandled error:", err);
            // Optionally, decide whether to throw the error or not
            // For now, we'll log it and keep the application running
        }
    });
}

function getHateWordsFromFile(filePath) {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        return fileContent.split('\n').map(word => word.trim()).filter(Boolean); // Removes empty lines
    } catch (error) {
        console.error('Error reading file:', error);
        return [];
    }
}

function isHateSpeech(text, hateWords) {
    const lowerCaseText = text.toLowerCase();
    return hateWords.some(hateWord => lowerCaseText.includes(hateWord.toLowerCase()));

}
// Handle the command input
rl.on('line', (input) => {
    const args = input.trim().split(/\s+/);
    const command = args[0].toLowerCase();
    const value = args[1]?.toLowerCase();

    switch (command) {
        case 'shorturlfilter':
            if (value === 'true') {
                shorturlfilter = true;
                fs.writeFileSync('./settings.txt', `shorturlfilter=${shorturlfilter}`);
                console.log('Custom short url filter set to: true.');
            }
            else if (value === 'false') {
                shorturlfilter = false;
                fs.writeFileSync('./settings.txt', `shorturlfilter=${shorturlfilter}`);
                console.log('Custom short url filter set to: false.');
            }
            else if (value === 'status') {
                console.log(`Short URL filter is currently set to: ${shorturlfilter}`);
                break;
            }
            else if (value === 'reload') {
                if (fs.existsSync('./settings.txt')) {
                    console.log('Reloading settings from settings.txt file.');
                    const data = fs.readFileSync('./settings.txt', 'utf8');
                    const lines = data.split('\n');
                    lines.forEach((line) => {
                        const [key, value] = line.split('=');
                        if (key === 'shorturlfilter') {
                            shorturlfilter = value === 'true';
                            console.log(`Short URL filter set to: ${shorturlfilter} from your settings.txt file.`);
                        }
                    });
                }
                else {
                    console.log('settings.txt file not found.');
                    fs.writeFileSync('./settings.txt', '');
                    console.log('Created settings.txt file.');
                    console.log("The shorturlfilter is set to true by default.");
                    fs.writeFileSync('./settings.txt', 'shoturlfilter=true');
                    shorturlfilter = true;
                }
                if (fs.existsSync('./filter.txt')) {
                    const hateWords = getHateWordsFromFile('./filter.txt');
                    console.log('Hate words loaded from filter.txt file.');
                }
                else {
                    console.log('filter.txt file not found.');
                    fs.writeFileSync('./filter.txt', 'exampleword1\nexampleword2\nexampleword3\n');
                    console.log('Created filter.txt file.');
                    console.log("Please add words to the filter.txt file to check for hate speech.");
                    console.log("Then run 'shorturlfilter reload' to reload the filter.");
                }
                break;
            }
            else {
                console.log('Invalid arguments. type "help" for more information.');
            }
            break;
        case 'help':
            console.log('Commands:');
            console.log('shorturlfilter <true/false/status/reload> - Set short url filter to true or false.');
            console.log('exit - Exit the application.');
            break;
        case 'exit':
            console.log('Exiting the application.');
            process.exit(0);  // Exit the Node.js program with a success status code
        default:
            console.log('Unknown command, type "help" for more information.');
    }
});

handleDisconnect();

app.get("/:anything", (req, res, next) => {
    const { anything } = req.params;

    // Check if the route is in the excluded list
    if (excludedRoutes.includes(`/${anything.toLowerCase()}`)) {
        return next(); // Skip this middleware and go to the next handler
    }

    connection.query(
        `SELECT * FROM shorturls WHERE shorturl = ?`,
        [anything],
        (err, results) => {
            if (err) {
                console.error("Database query error:", err.stack);
                return res.status(500).json({ error: "Database error" });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: "Short URL not found" });
            }
            res.redirect(results[0].redirecturl);
        }
    );
});

app.post("/signup", async (req, res) => {
    const userData = req.body;

    try {
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(userData.Password, 10);

        // Check database for existing username
        connection.query(
            "SELECT * FROM Users WHERE Username = ?",
            [userData.Username],
            (err, results) => {
                if (err) {
                    console.error("Error executing query:", err.stack);
                    return res.status(500).json({ error: "Database error" });
                }
                if (results.length > 0) {
                    return res.status(400).json({ error: "Username already exists" });
                } else {
                    // Username does not exist, proceed with insertion
                    const token = crypto.randomBytes(64).toString("hex");
                    connection.query(
                        "INSERT INTO Users (FirstName, LastName, Username, Password, token) VALUES (?, ?, ?, ?, ?)",
                        [
                            userData.FirstName,
                            userData.LastName,
                            userData.Username,
                            hashedPassword,
                            token,
                        ],
                        (err, results) => {
                            if (err) {
                                console.error("Error executing query:", err.stack);
                                return res.status(500).json({ error: "Database error" });
                            }
                            res.json({ message: token });
                        }
                    );
                }
            }
        );
    } catch (err) {
        console.error("Error hashing password:", err.stack);
        return res.status(500).json({ error: "Server error" });
    }
});

app.post("/login", (req, res) => {
    const userData = req.body;

    connection.query(
        "SELECT * FROM Users WHERE Username = ?",
        [userData.Username],
        (err, results) => {
            if (err) {
                console.error("Error executing query:", err.stack);
                return res.status(500).json({ error: "Database error" });
            }
            if (results.length === 0) {
                return res.status(401).json({ error: "Invalid username or password." });
            }

            const storedHash = results[0].Password;
            const token = results[0].token;

            // Compare the provided password with the hashed password in the database
            bcrypt.compare(userData.Password, storedHash, (err, isMatch) => {
                if (err) {
                    console.error("Error comparing passwords:", err.stack);
                    return res.status(500).json({ error: "Server error" });
                }
                if (!isMatch) {
                    return res
                        .status(401)
                        .json({ error: "Invalid username or password." });
                }
                res.json({ message: `${token}` });
            });
        }
    );
});

app.post("/message", (req, res) => {
    const messageData = req.body.message;
    const token = req.headers.token;

    console.log("Received token:", token);
    console.log("Received message:", messageData);

    connection.query(
        "SELECT * FROM Users WHERE token = ?",
        [token],
        (err, results) => {
            if (err) {
                console.error("Database query error:", err.stack);
                return res.status(500).json({ error: "Database error" });
            }
            if (results.length === 0) {
                return res
                    .status(401)
                    .json({ error: "Invalid token or session expired." });
            }
            const username = results[0].Username;

            const fullMessage = { username, message: messageData };
            console.log("Sending message to clients:", fullMessage);

            // Respond to the sender immediately
            res.status(200).json({ message: fullMessage });

            // Broadcast the message to all other connected clients
            clients.forEach((client) => {
                if (!client.res.finished) {
                    client.res.json({ message: fullMessage });
                }
            });

            // Clear the clients array after broadcasting
            clients = [];
        }
    );
});

app.get("/poll", (req, res) => {
    if (messages.length > 0) {
        res.json({ message: messages.shift() });
    } else {
        clients.push({ req, res });
    }
});

app.post("/getattrs", async (req, res) => {
    const {
        myattribute1,
        lvl1,
        myattribute2,
        lvl2,
        crimsonislepeicetocheckapi,
        minecraftarmourpeicetocheckapi,
    } = req.body;

    try {
        const uuid = await retrieveAuctionsAndCheckAttrs(
            myattribute1,
            lvl1,
            myattribute2,
            lvl2,
            crimsonislepeicetocheckapi,
            minecraftarmourpeicetocheckapi
        );

        if (uuid) {
            res.status(200).json({ uuid });
        } else {
            res.status(404).json({ message: "No matching UUID found" });
        }
    } catch (err) {
        console.error("Error in /getattrs route:", err);
        res
            .status(500)
            .json({ error: "An error occurred while retrieving the UUID" });
    }
});

async function retrieveAuctionsAndCheckAttrs(
    myattribute1,
    lvl1,
    myattribute2,
    lvl2,
    crimsonislepeicetocheckapi,
    minecraftarmourpeicetocheckapi
) {
    const headers = { "Content-Type": "application/json" };
    let uuids = [];
    let ratelimit = 0;
    let i = 0;
    let j = crimsonislepeicetocheckapi === "all" ? 50 : 10;
    let piecetocheck =
        crimsonislepeicetocheckapi.toUpperCase() +
        "_" +
        minecraftarmourpeicetocheckapi.toUpperCase();

    while (i < j) {
        if (crimsonislepeicetocheckapi === "all") {
            if (i > 40)
                piecetocheck = "HOLLOW_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else if (i > 30)
                piecetocheck = "FERVOR_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else if (i > 20)
                piecetocheck = "TERROR_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else if (i > 10)
                piecetocheck = "AURORA_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else
                piecetocheck =
                    "CRIMSON_" + minecraftarmourpeicetocheckapi.toUpperCase();
        }

        const urlToGetUuids = `https://sky.coflnet.com/api/auctions/tag/<span class="math-inline">\{piecetocheck\}/active/overview?orderBy\=LOWEST\_PRICE&page\=</span>{i}`;

        let response = await fetch(urlToGetUuids, { headers });

        if (response.status === 429) {
            if (ratelimit >= 3) {
                ratelimit = 0;
                console.log(`Rate limited 3 times. Retrying...`);
                await new Promise((resolve) => setTimeout(resolve, 10000));
                continue;
            } else {
                ratelimit += 1;
                console.log("Rate limit hit. Waiting 0.5 seconds...");
                await new Promise((resolve) => setTimeout(resolve, 500));
                continue;
            }
        }

        let responseJson;
        try {
            responseJson = await response.json();
        } catch (error) {
            console.log(`Error decoding JSON from ${urlToGetUuids}: ${error}`);
            continue;
        }

        if (Array.isArray(responseJson)) {
            uuids = responseJson.map((item) => item.uuid).filter((uuid) => uuid);

            for (let uuid of uuids) {
                const urlToGetAttrs = `https://sky.coflnet.com/api/auction/${uuid}`;

                try {
                    response = await fetch(urlToGetAttrs, { headers });

                    if (response.status === 429) {
                        if (ratelimit >= 3) {
                            ratelimit = 0;
                            console.log(`Rate limited 3 times. Retrying...`);
                            await new Promise((resolve) => setTimeout(resolve, 1000));
                            continue;
                        } else {
                            ratelimit += 1;
                            await new Promise((resolve) => setTimeout(resolve, 300));
                            continue;
                        }
                    }

                    let attributes;
                    try {
                        const data = await response.json();
                        attributes = data.nbtData?.data?.attributes || {};
                    } catch (error) {
                        console.log(`Error decoding JSON from ${urlToGetAttrs}: ${error}`);
                        continue;
                    }

                    if (myattribute2) {
                        if (
                            attributes[myattribute1] === lvl1 &&
                            attributes[myattribute2] === lvl2
                        ) {
                            return uuid;
                        }
                    } else {
                        if (attributes[myattribute1] === lvl1) {
                            return uuid;
                        }
                    }
                } catch (error) {
                    console.log(`Request failed for ${urlToGetAttrs}: ${error}`);
                    continue;
                }
            }
        }

        uuids = [];
        i += 1;
    }

    return null;
}

app.get('/validurl', async (req, res) => {
    // Check if the URL query parameter is present
    if (!req.query.url) {
        return res.status(400).json({ Error: "URL parameter is missing" });
    }

    const url = decodeURIComponent(req.query.url); // Decode the URL parameter
    try {
        // Check if the URL exists
        const response = await axios.get(url);
        if (response.status === 200) {
            return res.status(200).json({ message: 'URL exists' });
        }
    } catch (error) {
        if (error.message.includes("ENOTFOUND")) {
            return res.status(404).json({ message: error.message });
        }
        else {
            return res.status(200).json({ message: 'URL exists' + error.message });
        }
    }
});

app.post("/addshorturl", (req, res) => {
    const userData = req.body;
    const token = req.headers.token;

    if (!token) {
        return res.status(400).json({ error: "Token is required." });
    }
    if (!userData.redirecturl) {
        return res.status(402).json({ error: "Redirect URL is required." });
    }
    const redirecturl = userData.redirecturl;

    connection.query("SELECT * FROM Users WHERE token = ?", [token], (err, results) => {
        if (err) {
            console.error("Database query error:", err.stack);
            return res.status(500).json({ error: "Database error" });
        }
        if (results.length === 0) {
            return res.status(401).json({ error: "Invalid token or session expired." });
        }

        if (userData.customshorturlcode) {
            const customshorturl = userData.customshorturlcode;
            if (shorturlfilter && isHateSpeech(customshorturl, hatewords)) {
                return res.status(403).json({ error: "Short URL contains profanity." });
            }
            else if (!/^[a-zA-Z0-9]+$/.test(customshorturl)) {
                return res.status(405).json({ error: "Short URL contains invalid characters." });
            }
            else if (excludedRoutes.includes(`/${customshorturl.toLowerCase()}`)) {
                return res.status(406).json({ error: "Short URL is invalid and is one of the api routes." });
            }

            connection.query(`SELECT * FROM shorturls WHERE shorturl = ?`, [customshorturl], (err, results) => {
                if (err) {
                    console.error("Database query error:", err.stack);
                    return res.status(500).json({ error: "Database error" });
                }
                if (results.length > 0) {
                    return res.status(404).json({ error: "Short URL already exists." });
                }

                connection.query(
                    `INSERT INTO shorturls (redirecturl, shorturl, token) VALUES (?, ?, ?)`,
                    [redirecturl, customshorturl, token],
                    (err) => {
                        if (err) {
                            console.error("Database insertion error:", err.stack);
                            return res.status(500).json({ error: "Database error" });
                        }
                        res.status(200).json({ message: customshorturl });
                    }
                );
            });
        } else {
            const userid = results[0].ID;
            const newshorturl = userid + crypto.randomBytes(2).toString("hex");
            connection.query(
                `INSERT INTO shorturls (redirecturl, shorturl, token) VALUES (?, ?, ?)`,
                [redirecturl, newshorturl, token],
                (err) => {
                    if (err) {
                        console.error("Database insertion error:", err.stack);
                        return res.status(500).json({ error: "Database error" });
                    }
                    res.status(200).json({ message: newshorturl });
                }
            );
        }
    });
});

app.post("/removeshorturl", (req, res) => {
    // check token
    const token = req.headers.token;
    // check the short url because they will be unique
    const shorturlremove = req.body.shorturl;
    if (!shorturlremove) {
        return res.status(400).json({ error: "Short URL is required." });
    }

    // Check all the tokens urls
    connection.query(
        `SELECT * FROM shorturls WHERE token = ? AND shorturl = ?`,
        [token, shorturlremove],
        (err, results) => {
            if (err) {
                console.error("Database query error:", err.stack);
                return res.status(500).json({ error: "Database error" });
            } else if (results.length === 0) {
                return res.status(404).json({
                    error: "You dont have any short urls or it doesnt belong to you.",
                });
            } else {
                connection.query(
                    `DELETE FROM shorturls WHERE shorturl = ?`,
                    [shorturlremove],
                    (err, results) => {
                        if (err) {
                            console.error("Database query error:", err.stack);
                            return res.status(500).json({ error: "Database error" });
                        } else {
                            res.status(200).json({ message: "Short URL removed." });
                        }
                    }
                );
            }
        }
    );
});

app.get("/getshorturls", (req, res) => {
    // check token
    const token = req.headers.token;
    if (!token) {
        return res.status(400).json({ error: "Token is required." });
    }
    // get all short urls of the user with that token
    connection.query(
        `SELECT id, redirecturl, shorturl FROM shorturls WHERE token = ?`,
        [token],
        (err, results) => {
            if (err) {
                console.error("Database query error:", err.stack);
                return res.status(500).json({ error: "Database error" });
            } else {
                res.status(200).json({ message: results });
            }
        }
    );
});

// Fallback route for non-existing routes
app.use("*", (req, res) => {
    res.status(404).send("Route not found.");
});

app.listen(port, ip, () => {
    if (fs.existsSync('./settings.txt')) {
        console.log('Grabbing settings from settings.txt file.');
        const data = fs.readFileSync('./settings.txt', 'utf8');
        const lines = data.split('\n');
        lines.forEach((line) => {
            const [key, value] = line.split('=');
            if (key === 'shorturlfilter') {
                shorturlfilter = value === 'true';
                console.log(`Short URL filter set to: ${shorturlfilter} from your settings.txt file.`);
            }
        });
    }
    else {
        console.log('settings.txt file not found.');
        fs.writeFileSync('./settings.txt', '');
        console.log('Created settings.txt file.');
        console.log("The shorturlfilter is set to true by default.");
        fs.writeFileSync('./settings.txt', 'shorturlfilter=true');
        shorturlfilter = true
    }
    if (fs.existsSync('./filter.txt')) {;
        let hateWords = getHateWordsFromFile('./filter.txt');
        console.log('Hate words loaded from filter.txt file.');
    }
    else {
        console.log('filter.txt file not found.');
        fs.writeFileSync('./filter.txt', 'exampleword1\nexampleword2\nexampleword3\n');
        console.log('Created filter.txt file.');
        console.log("Please add words to the filter.txt file to check for hate speech.");
        console.log("Then run shorturlfilter reload to reload the filter.");
    }
    console.log(`API listening at port: ${port} on: ${ip}`);
    console.log("Type 'help' for a list of commands.");
    console.log("-----------------------------------------");
});

