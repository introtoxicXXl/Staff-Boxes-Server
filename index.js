require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

app = express();

app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.q1v3e.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db('Stuff-boxes').collection('users');

        // middleware 
        // verify token 
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorization Access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.JWT_SECRET, (err) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorization Access' })
                }
                req.decoded = decoded
                next()
            })
        }
        // admin verify
        const adminVerify = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.find(query);
            const isAdmin = user.role === "Admin";
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            next();
        }
        // deliveryMan verify
        const deliveryMan = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.find(query);
            const isAdmin = user.role === "Delivery Man";
            if (!isAdmin) {
                return res.status(403).send({ message: 'Forbidden Access' })
            }
            next();
        }

        // jwt api 
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.JWT_SECRET, { expiresIn: '3h' });
            res.send({ token })
        })

        // users get api 
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result)
        })
        // user post api 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existUser = await usersCollection.findOne(query);
            if (existUser) {
                return res.send({ message: 'User already in database' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })







        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);







app.get('/', (req, res) => {
    res.send('Stuff Boxes is on the way with your Parcel')
})
app.listen(port, () => {
    console.log('stuff boxes right now on', port)
})