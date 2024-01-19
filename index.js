require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;

app = express();

app.use(cors())
app.use(express.json())




const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
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
        const bookParcelCollection = client.db('Stuff-boxes').collection('bookParcel');

        // middleware 
        // verify token 
        const verifyToken = (req, res, next) => {
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'Unauthorize Access' })
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'Unauthorize Access' })
                }
                req.decoded = decoded;
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

        // user related api 
        // users get api 
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await usersCollection.findOne(query);
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
        // admin api 
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Unauthorize Access' })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === "Admin"
            }
            res.send({ admin })
        })
        // deliveryman api 
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Unauthorize Access' })
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            let deliveryMan = false;
            if (user) {
                admin = user?.role === "Delivery Man"
            }
            res.send({ deliveryMan })
        })
        // make admin api 
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'Admin'
                }
            }
            const result = await usersCollection.updateOne(filter, updateDoc)
            res.send(result);
        })

        // booking parcel api 
        // book parcel post api 
        app.post('/bookParcel', verifyToken, async (req, res) => {
            const bookingInfo = req.body;
            const result = await bookParcelCollection.insertOne(bookingInfo);
            res.send(result);
        })
        // book parcel get api by email
        app.get('/bookParcel/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await bookParcelCollection.find(query).toArray();
            res.send(result);
        })
        // book parcel get api by id
        app.get('/bookMyParcel/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await bookParcelCollection.findOne(query);
            res.send(result);
        })
        // book parcel patch api by id
        app.patch('/bookMyParcel/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const item = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    firstName: item.firstName,
                    lastName: item.lastName,
                    email: item.email,
                    phoneNumber: item.phoneNumber,
                    parcelType: item.parcelType,
                    receiverName: item.receiverName,
                    price: item.price,
                    receiverPhone: item.receiverPhone,
                    deliveryAddress: item.deliveryAddress,
                    requestDate: item.requestDate,
                    deliveryAddressLatitude: item.deliveryAddressLatitude,
                    deliveryAddressLongitude: item.deliveryAddressLongitude,
                    parcelWeight: item.parcelWeight
                }
            }
            const result = await bookParcelCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.patch('/cancel/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const filter = { _id: new ObjectId(id) };
            const doc = {
                $set: {
                    status: "Cancel"
                }
            }
            const result = await bookParcelCollection.updateOne(filter, doc)
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