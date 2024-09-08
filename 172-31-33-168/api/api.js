import express from 'express';
import cors from 'cors';
import mysql from 'mysql2';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import https from "https";
import { URL } from 'url'; 
import { connect } from 'http2';
const app = express();
dotenv.config();
const port = 4000
const ip = process.env.IP;

const limiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 200,
    message: 'Too many requests from this IP, please try again after 1 minute',
});

app.set('trust proxy', 1);
app.use(cors({
    origin: 'https://bubllz.com', // Replace with your client's domain
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'token'],
}));
app.use(express.json());
app.use(limiter);
let messages = [];
let clients = [];
const excludedRoutes = ['/login', '/signup', '/message', '/poll', '/validurl', '/checkshorturls', '/addshorturl', '/removeshorturl', '/getattrs'];

// Database connection
let connection;

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
            console.error('Error connecting to database:', err);
            setTimeout(handleDisconnect, 2000); // Reconnect after 2 seconds
        } else {
            console.log('Connected to database');
        }
    });
    
    connection.on('error', (err) => {
        console.error('Database error:', err);
        if (err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
            handleDisconnect(); // Reconnect on connection loss or reset
        } else {
            console.error('Unhandled error:', err);
            // Optionally, decide whether to throw the error or not
            // For now, we'll log it and keep the application running
        }
    });
}

handleDisconnect();

app.get('/:anything', (req, res, next) => {
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
                console.error('Database query error:', err.stack);
                return res.status(500).json({ error: 'Database error' });
            }
            if (results.length === 0) {
                return res.status(404).json({ error: 'Short URL not found' });
            }
            res.redirect(results[0].redirecturl);
        }
    )
});

app.post('/signup', async (req, res) => {
    const userData = req.body;

    try {
        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(userData.Password, 10);

        // Check database for existing username
        connection.query(
            'SELECT * FROM Users WHERE Username = ?',
            [userData.Username],
            (err, results) => {
                if (err) {
                    console.error('Error executing query:', err.stack);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (results.length > 0) {
                    return res.status(400).json({ error: 'Username already exists' });
                } else {
                    // Username does not exist, proceed with insertion
                    const token = crypto.randomBytes(64).toString('hex');
                    connection.query(
                        'INSERT INTO Users (FirstName, LastName, Username, Password, token) VALUES (?, ?, ?, ?, ?)',
                        [userData.FirstName, userData.LastName, userData.Username, hashedPassword, token],
                        (err, results) => {
                            if (err) {
                                console.error('Error executing query:', err.stack);
                                return res.status(500).json({ error: 'Database error' });
                            }
                            res.json({ message: token });
                        }
                    );
                }
            }
        );
    } catch (err) {
        console.error('Error hashing password:', err.stack);
        return res.status(500).json({ error: 'Server error' });
    }
});

app.post('/login', (req, res) => {
    const userData = req.body;

    connection.query(
        'SELECT * FROM Users WHERE Username = ?',
        [userData.Username],
        (err, results) => {
            if (err) {
                console.error('Error executing query:', err.stack);
                return res.status(500).json({ error: 'Database error' });
            }
            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid username or password.' });
            }

            const storedHash = results[0].Password;
            const token = results[0].token;

            // Compare the provided password with the hashed password in the database
            bcrypt.compare(userData.Password, storedHash, (err, isMatch) => {
                if (err) {
                    console.error('Error comparing passwords:', err.stack);
                    return res.status(500).json({ error: 'Server error' });
                }
                if (!isMatch) {
                    return res.status(401).json({ error: 'Invalid username or password.' });
                }
                res.json({ message: `${token}` });
            });
        }
    );
});

app.post('/message', (req, res) => {
    const messageData = req.body.message;
    const token = req.headers.token;

    console.log('Received token:', token);
    console.log('Received message:', messageData);

    connection.query(
        'SELECT * FROM Users WHERE token = ?',
        [token],
        (err, results) => {
            if (err) {
                console.error('Database query error:', err.stack);
                return res.status(500).json({ error: 'Database error' });
            }
            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid token or session expired.' });
            }
            const username = results[0].Username;

            const fullMessage = { username, message: messageData };
            console.log('Sending message to clients:', fullMessage);

            // Respond to the sender immediately
            res.status(200).json({ message: fullMessage });

            // Broadcast the message to all other connected clients
            clients.forEach(client => {
                if (!client.res.finished) {
                    client.res.json({ message: fullMessage });
                }
            });

            // Clear the clients array after broadcasting
            clients = [];
        }
    );
});


app.get('/poll', (req, res) => {
    if (messages.length > 0) {
        res.json({ message: messages.shift() });
    } else {
        clients.push({ req, res });
    }
});

app.post('/getattrs', async (req, res) => {
    const { myattribute1, lvl1, myattribute2, lvl2, crimsonislepeicetocheckapi, minecraftarmourpeicetocheckapi } = req.body;
    
    try {
        const uuid = await retrieveAuctionsAndCheckAttrs(myattribute1, lvl1, myattribute2, lvl2, crimsonislepeicetocheckapi, minecraftarmourpeicetocheckapi);
        
        if (uuid) {
            res.status(200).json({ uuid });
        } else {
            res.status(404).json({ message: 'No matching UUID found' });
        }
    } catch (err) {
        console.error('Error in /getattrs route:', err);
        res.status(500).json({ error: 'An error occurred while retrieving the UUID' });
    }
});

async function retrieveAuctionsAndCheckAttrs(myattribute1, lvl1, myattribute2, lvl2, crimsonislepeicetocheckapi, minecraftarmourpeicetocheckapi) {
    const headers = { 'Content-Type': 'application/json' };
    let uuids = [];
    let ratelimit = 0;
    let i = 0;
    let j = crimsonislepeicetocheckapi === 'all' ? 50 : 10;
    let piecetocheck = crimsonislepeicetocheckapi.toUpperCase() + "_" + minecraftarmourpeicetocheckapi.toUpperCase();

    while (i < j) {
        if (crimsonislepeicetocheckapi === "all") {
            if (i > 40) piecetocheck = "HOLLOW_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else if (i > 30) piecetocheck = "FERVOR_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else if (i > 20) piecetocheck = "TERROR_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else if (i > 10) piecetocheck = "AURORA_" + minecraftarmourpeicetocheckapi.toUpperCase();
            else piecetocheck = "CRIMSON_" + minecraftarmourpeicetocheckapi.toUpperCase();
        }

        const urlToGetUuids = `https://sky.coflnet.com/api/auctions/tag/${piecetocheck}/active/overview?orderBy=LOWEST_PRICE&page=${i}`;
        
        let response = await fetch(urlToGetUuids, { headers });
        
        if (response.status === 429) {
            if (ratelimit >= 3) {
                ratelimit = 0;
                console.log(`Rate limited 3 times. Retrying...`);
                await new Promise(resolve => setTimeout(resolve, 10000));
                continue;
            } else {
                ratelimit += 1;
                console.log("Rate limit hit. Waiting 0.5 seconds...");
                await new Promise(resolve => setTimeout(resolve, 500));
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
            uuids = responseJson.map(item => item.uuid).filter(uuid => uuid);

            for (let uuid of uuids) {
                const urlToGetAttrs = `https://sky.coflnet.com/api/auction/${uuid}`;

                try {
                    response = await fetch(urlToGetAttrs, { headers });

                    if (response.status === 429) {
                        if (ratelimit >= 3) {
                            ratelimit = 0;
                            console.log(`Rate limited 3 times. Retrying...`);
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            continue;
                        } else {
                            ratelimit += 1;
                            await new Promise(resolve => setTimeout(resolve, 300));
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
                        if (attributes[myattribute1] === lvl1 && attributes[myattribute2] === lvl2) {
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

app.get('/validurl', (req, res) => {
    // Check if the URL query parameter is present
    if (!req.query.url) {
        return res.status(400).json({ 'Error': 'URL parameter is missing' });
    }

    try {
        // Parse the URL
        const parsedUrl = new URL(req.query.url);

        // Set options for the https.get request
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.pathname + (parsedUrl.search || ''), // Include search params if present
            method: 'GET',
            rejectUnauthorized: false // Disable SSL certificate validation
        };

        // Make the https request
        https.get(options, (response) => {
            const { statusCode } = response;

            if (statusCode >= 200 && statusCode < 300) {
                res.status(200).json({ 'Validurl': true });
            } else {
                res.status(250).json({ 'Validurl': false });
            }
        }).on('error', (err) => {
            console.log('Error:', err.message);
            res.status(250).json({ 'Error': err.message });
        });

    } catch (err) {
        // Handle any errors that occurred during URL parsing or request
        console.error('Error parsing URL:', err.message);
        res.status(250).json({ 'Error': 'Invalid URL format' });
    }
});

app.get('/checkshorturls', (req, res) => {
    // check token
    // get all short urls of the user with that token
});
app.post('/addshorturl', (req, res) => {
    // check auth key
    // make a unique short url code
    // add the short url with, oldurl, shorturl, token
    const userData = req.body;
    const token = req.headers.token;

    connection.query(
        'SELECT * FROM Users WHERE token = ?',
        [token],
        (err, results) => {
            if (err) {
                console.error('Database query error:', err.stack);
                return res.status(500).json({ error: 'Database error' });
            }
            if (results.length === 0) {
                return res.status(401).json({ error: 'Invalid token or session expired.' });
            }
            const userid = results[0].ID;
            const redirecturl = userData.redirecturl;
            const newshorturl = userid + crypto.randomBytes(2).toString('hex');

    connection.query(      
        `INSERT INTO shorturls (redirecturl, shorturl, token) VALUES (?, ?, ?)`,
        [redirecturl, newshorturl, token]
        );

    res.status(200).json({ message: newshorturl });
        }
    );
});

app.post('/removeshorturl', (req, res) => {
    // check token
    // check the short url because they will be unique
    // remove the short url
});

// Fallback route for non-existing routes
app.use('*', (req, res) => {
  res.status(404).send('Route not found.');
});

app.listen(port, ip, () => {
    console.log(`API listening at port: ${port} on: ${ip}`);
});