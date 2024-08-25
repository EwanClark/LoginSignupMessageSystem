const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const app = express();
require('dotenv').config();

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

    
app.get('/', (req, res) => {
    res.send('This is an API, not a website! You need to run api.bubllz.com/{your request}');
});

app.post('/', (req, res) => {
    res.send('This is an API, not a website! You need to run api.bubllz.com/{your request}');
});

app.listen(port, ip, () => {
    console.log(`API listening at port: ${port} on: ${ip}`);
});
