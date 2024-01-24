require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
// const moment = require('moment');
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIP_SECRET_KEY);

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
        const deliveryMansCollection = client.db('Stuff-boxes').collection('deliveryMan');
        const bookParcelCollection = client.db('Stuff-boxes').collection('bookParcel');
        const paymentsCollection = client.db('Stuff-boxes').collection('payment');
        const reviewsCollection = client.db('Stuff-boxes').collection('review');

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
            const user = await usersCollection.findOne(query);
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
            const user = await usersCollection.findOne(query);
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
        // users get api 
        app.get('/admin/userDetails', verifyToken, async (req, res) => {
            const pipeline = [
                {
                    $match: {
                        role: { $in: ['Customer', 'Admin', 'Delivery Man'] }
                    }
                },
                {
                    $lookup: {
                        from: 'bookParcel',
                        localField: 'email',
                        foreignField: 'email',
                        as: 'parcels'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        firstName: 1,
                        lastName: 1,
                        email: 1,
                        role: 1,
                        image: 1,
                        phoneNumber: 1,
                        numberOfParcels: { $size: '$parcels' },
                        totalSpentMoney: { $sum: '$parcels.price' }
                    }
                }
            ];
            const result = await usersCollection.aggregate(pipeline).toArray();
            res.send(result)
        })

        app.get('/admin/manageParcel', async (req, res) => {
            const result = await deliveryMansCollection.find().toArray();
            res.send(result)
        })

        app.patch('/admin/updateParcel/:id', async (req, res) => {
            const id = req.params.id;
            const { deliveryManId, status } = req.body;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    deliveryManId,
                    status,
                }
            };

            const result = await bookParcelCollection.updateOne(filter, updateDoc);
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
            if (user.role === 'Delivery Man') {
                user.deliveryCount = 0;
                const result = await deliveryMansCollection.insertOne(user);
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
        app.get('/users/deliveryMan/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'Unauthorize Access' })
            }
            const query = { email: email };
            const user = await deliveryMansCollection.findOne(query)
            res.send(user)
        })
        // make admin api 
        app.patch('/users/admin/:id', verifyToken, adminVerify, async (req, res) => {
            const userId = req.params.id;
            const role = req.body.role;
            if (role === 'Delivery Man') {
                const userFilter = { _id: new ObjectId(userId) };
                const userUpdateDoc = {
                    $set: {
                        role: role,
                        deliveryCount: 0,
                    }
                };
                const result = await usersCollection.updateOne(userFilter, userUpdateDoc);
                res.send(result)
            }
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
        // book parcel get api 
        app.get('/bookParcel', verifyToken, adminVerify, async (req, res) => {
            const result = await bookParcelCollection.find().toArray();
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

        app.patch('/update/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const item = req.body;
            const filter = { _id: new ObjectId(id) };
            const doc = {
                $set: {
                    status: item.status
                }
            }
            const result = await bookParcelCollection.updateOne(filter, doc)
            res.send(result)
        })

        app.get('/admin/allDeliveryMan', verifyToken, async (req, res) => {
            const result = await deliveryMansCollection.find().toArray()
            res.send(result)
        })

        app.get('/deliveryMan/review/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await deliveryMansCollection.findOne(query);
            res.send(result)
        })

        app.get('/deliveryMan/bookedParcel/:id', verifyToken, async (req, res) => {
            const id = req.params.id;
            const pipeline = [
                {
                    $match: { deliveryManId: id }
                },
                {
                    $lookup: {
                        from: 'users',
                        localField: 'email',
                        foreignField: 'email',
                        as: 'userDetails'
                    }
                },
                {
                    $project: {
                        _id: 1,
                        bookedUserName: {
                            $concat: [
                                { $arrayElemAt: ['$userDetails.firstName', 0] },
                                ' ',
                                { $arrayElemAt: ['$userDetails.lastName', 0] }
                            ]
                        },
                        receiversName: '$receiverName',
                        bookedUserPhone: { $arrayElemAt: ['$userDetails.phoneNumber', 0] },
                        requestedDeliveryDate: '$requestDate',
                        approximateDeliveryDate: '$approximateDate',
                        receiversPhoneNumber: '$receiverPhone',
                        receiversAddress: '$deliveryAddress',
                        deliveryAddressLatitude: '$deliveryAddressLatitude',
                        deliveryAddressLongitude: '$deliveryAddressLongitude',
                        status: '$status',
                    }
                }
            ];

            const result = await bookParcelCollection.aggregate(pipeline).toArray();
            res.send(result);
        })

        // top delivery man api 
        app.get('/topDeliveryMan', async (req, res) => {
            const result = await bookParcelCollection.aggregate([
                {
                    $match: {
                        status: 'Delivered'
                    }
                },
                {
                    $group: {
                        _id: '$deliveryManId',
                        totalReviews: { $sum: 1 },
                        totalDeliveryCount: { $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] } },
                        averageRating: { $avg: '$deliveryManRating' }
                    }
                },
                {
                    $sort: {
                        totalReviews: -1,
                        totalDeliveryCount: -1
                    }
                },
                {
                    $limit: 5
                }
            ]).toArray();

            const userIds = result.map(item => new ObjectId(item._id));

            const deliveryMen = await usersCollection.find({
                _id: { $in: userIds },
                role: 'Delivery Man'
            }).project({
                _id: 1,
                firstName: 1,
                lastName: 1,
                image: 1,
                reviews: 1
            }).toArray();

            const topDeliveryMen = result.map(item => {
                const deliveryManInfo = deliveryMen.find(d => d._id.equals(new ObjectId(item._id)));

                const totalRating = deliveryManInfo.reviews.reduce((sum, review) => sum + review.rating, 0);
                const averageRating = totalRating / deliveryManInfo.reviews.length;

                return {
                    _id: deliveryManInfo._id,
                    firstName: deliveryManInfo.firstName,
                    lastName: deliveryManInfo.lastName,
                    image: deliveryManInfo.image,
                    averageRating,
                    totalDeliveryCount: item.totalDeliveryCount
                };
            });

            res.send(topDeliveryMen);
        })

        // stat api 
        app.get('/userStat/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const pipeline = [
                {
                    $match: { email: { $eq: email } }
                },
                {
                    $group: {
                        _id: null,
                        parcelCount: { $sum: 1 },
                        totalCost: {
                            $sum: {
                                $cond: {
                                    if: { $eq: ['$paymentStatus', 'Success'] },
                                    then: '$price',
                                    else: 0
                                }
                            }
                        }
                    }
                },
                {
                    $project: {
                        _id: 0,
                        parcelCount: 1,
                        totalCost: 1
                    }
                }
            ];

            const result = await bookParcelCollection.aggregate(pipeline).toArray();
            if (result.length > 0) {
                res.send(result[0]);
            } else {
                res.send({ parcelCount: 0, totalCost: 0 });
            }
        })
        // admin stat api 
        app.get('/admin-stat', async (req, res) => {

            const parcelCountPipeline = [
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$bookingDate" } } },
                        parcelCount: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        bookingDate: "$_id",
                        parcelCount: 1,
                    },
                },
                {
                    $sort: { bookingDate: 1 },
                },
            ];
            const paymentStatusPipeline = [
                {
                    $match: {
                        paymentStatus: { $in: ['Pending', 'Success'] },
                    },
                },
                {
                    $group: {
                        _id: "$paymentStatus",
                        count: { $sum: 1 },
                    },
                },
                {
                    $project: {
                        _id: 0,
                        paymentStatus: "$_id",
                        count: 1,
                    },
                },
            ];

            const parcelCountResult = await bookParcelCollection.aggregate(parcelCountPipeline).toArray();
            const paymentStatusResult = await bookParcelCollection.aggregate(paymentStatusPipeline).toArray();
            res.send({ parcelCountResult, paymentStatusResult });
        })

        // payment gateway api
        app.post('/create-payment-intent', verifyToken, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            })
            res.send({
                clientSecret: paymentIntent.client_secret
            });
        })

        app.post('/payment', verifyToken, async (req, res) => {
            if (req.decoded.email !== req.body.email) {
                return res.status(401).send({ message: 'Forbidden access' })
            }
            const payment = req.body;
            const filter = { _id: new ObjectId(req.body.paymentUserId) }
            const paymentResult = await paymentsCollection.insertOne(payment);
            const updateDoc = {
                $set: {
                    transactionId: payment.transactionId,
                    paymentStatus: payment.paymentStatus
                }
            }
            const result = await bookParcelCollection.updateOne(filter, updateDoc);
            res.send(paymentResult);
        })


        // review api 
        app.post('/review', async (req, res) => {
            const review = req.body;
            const result = await reviewsCollection.insertOne(review);
            const deliveryManId = review.deliveryManId;
            const deliveryManFilter = { _id: new ObjectId(deliveryManId) };
            const deliveryManUpdate = {
                $push: {
                    reviews: review
                }
            };

            await deliveryMansCollection.updateOne(deliveryManFilter, deliveryManUpdate);
            await usersCollection.updateOne(deliveryManFilter, deliveryManUpdate);

            res.send(result)
        })
        app.get('/review', async (req, res) => {
            const result = await reviewsCollection.aggregate([
                { $sample: { size: 25 } }
            ]).toArray();
            res.send(result);
        });


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