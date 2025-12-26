const express = require('express')
const cors = require('cors')
const app = express()
require('dotenv').config()
const verifyFBtoken = require("./middleware/verifyFBtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const port = process.env.PORT || 3000

// const serviceAccount = require("./firebase-admin-key.json");



//middleware
app.use(express.json())
app.use(cors())



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.q7tqgdi.mongodb.net/?appName=Cluster0`;

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
    //await client.connect();
    const database = client.db('artistdb')
    const usersCollection = database.collection("users");
    const contentsCollection = database.collection("contents");

    // Save user data after login
    app.post('/api/users', async (req, res) => {
      try {
        const user = req.body; // { name, email, uid, ... }
        if (!user?.email) return res.status(400).json({ message: "Email is required" });



        // Check if user already exists
        const existingUser = await usersCollection.findOne({ email: user.email });
        if (existingUser) {
          return res.json({ message: "User already exists", user: existingUser });
        }

        // Insert new user
        const result = await usersCollection.insertOne(user);
        res.status(201).json({ message: "User created", user: result });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to save user" });
      }
    });
    // In your Express backend (server.js or index.js)

    // Get a user by uid
    app.get("/api/users/:uid", verifyFBtoken, async (req, res) => {
      const { uid } = req.params;
      try {

        const user = await usersCollection.findOne({ uid });
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json({ user });
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch user" });
      }
    });

    /* -------- Create Content (Artist) -------- */
    app.post("/api/content", verifyFBtoken, async (req, res) => {
      try {
        const content = req.body;
        if (!content.title || !content.artistId) {
          return res.status(400).json({ message: "Invalid content data" });
        }

        const result = await contentsCollection.insertOne(content);
        res.status(201).json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to upload content" });
      }
    });

    // ==============================
    app.get("/api/content", verifyFBtoken, async (req, res) => {
      try {
        const artistId = req.query.artistId;
        const requesterUid = req.user.uid; // <- use req.user, not req.decoded

        let query = {};

        if (artistId) {
          // Artist can only request their own content
          if (artistId !== requesterUid) {
            return res.status(403).json({ message: "Forbidden" });
          }
          query.artistId = artistId;
        }

        // Admin can see everything
        const user = await usersCollection.findOne({ uid: requesterUid });
        if (user.role === "admin") query = {};

        const contents = await contentsCollection.find(query).toArray();
        res.json(contents);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch contents" });
      }
    });


    // Update status
    app.patch('/api/content/:id/status', verifyFBtoken, async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;
      try {


        const result = await contentsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );
        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update status' });
      }
    });

    // Update metrics
    // Update metrics
    app.patch('/api/content/:id/metrics', verifyFBtoken, async (req, res) => {
      const { id } = req.params;
      const { platform, views, revenue } = req.body;

      try {
        const result = await contentsCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $push: { metrics: { platform, views, revenue, date: new Date() } }
          }
        );
        res.json(result);
      } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update metrics' });
      }
    });


    //edit content
    app.patch("/api/content/:id", verifyFBtoken, async (req, res) => {
      const { id } = req.params;
      const { title, description } = req.body;

      const result = await contentsCollection.updateOne(
        { _id: new ObjectId(id) },
        { $set: { title, description } }
      );

      res.json(result);
    });







    // Send a ping to confirm a successful connection
    //await client.db("admin").command({ ping: 1 });
    //   console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})
