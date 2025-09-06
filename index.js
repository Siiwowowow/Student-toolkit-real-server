const express = require('express')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors')
const app = express()
const port = process.env.PORT || 3000;
require('dotenv').config()

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ikrarq7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

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
    // await client.connect();
    const db = client.db("CollageDB");
    const usersCollection = db.collection("users");
    const classesCollection = db.collection("class");
    const budgetCollection = db.collection("budgets");

    //=========================users api=========================
    app.get("/users", async (req, res) => {
      try {
        if (!usersCollection) {
          return res.status(500).json({ success: false, message: "Database not connected" });
        }
    
        const users = await usersCollection.find({}).toArray();
    
        // If no users found
        if (!users || users.length === 0) {
          return res.status(404).json({ success: false, message: "No users found" });
        }
    
        res.status(200).json({ success: true, data: users });
      } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ success: false, message: "Failed to fetch users", error: error.message });
      }
    });
    
    app.post("/users", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) return res.status(400).send({ success: false, error: "Email is required" });

        const existingUser = await usersCollection.findOne({ email });
        if (existingUser) return res.send({ success: true, message: "User exists", data: existingUser });

        const user = { ...req.body, createdAt: new Date(), last_log_in: new Date() };
        const result = await usersCollection.insertOne(user);
        res.send({ success: true, data: { ...user, _id: result.insertedId } });
      } catch (err) {
        res.status(500).send({ success: false, error: err.message });
      }
    });
    //=========================class api=========================
    app.get("/class", async (req, res) => {
      const { email } = req.query;
      let query = {};
      if (email) {
        query.email = email;
      }

      const classes = await classesCollection.find(query).toArray();
      res.send({ success: true, data: classes });
    });
    app.post("/class", async (req, res) => {
      const { email } = req.body;
      if (!email) {
        return res.status(400).send({ success: false, message: "Email is required" });
      }
      const result = await classesCollection.insertOne(req.body);
      res.send({ success: true, data: { ...req.body, _id: result.insertedId } });
      res.send(result);
    });
    app.delete("/class/:id", async (req, res) => {
      const { id } = req.params;
      const result = await classesCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    

    //=========================budget api=========================
    app.get("/budgets", async (req, res) => {
      try {
        const { email } = req.query;
        let query = {};
        if (email) {
          query.email = email; 
        }
        const budget = await budgetCollection.find(query).toArray();
        res.send(budget);
      } catch (err) {
        res.status(500).send({ success: false, message: "Server error", error: err.message });
      }
    });

    app.post("/budgets", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).send({ success: false, message: "Email is required" });
        }
        const result = await budgetCollection.insertOne(req.body);
        res.send({ success: true, data: result });
      } catch (err) {
        res.status(500).send({ success: false, message: "Server error", error: err.message });
      }
    });
    app.delete("/budgets/:id", async (req, res) => {
      try {
        const { id } = req.params;
        
        // Validate if ID is provided
        if (!id) {
          return res.status(400).send({ success: false, message: "Budget ID is required" });
        }

        // Validate if ID is a valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ success: false, message: "Invalid budget ID format" });
        }

        const result = await budgetCollection.deleteOne({ _id: new ObjectId(id) });
        
        if (result.deletedCount === 0) {
          return res.status(404).send({ success: false, message: "Budget not found" });
        }

        res.send({ success: true, message: "Budget deleted successfully", data: result });
      } catch (err) {
        res.status(500).send({ success: false, message: "Server error", error: err.message });
      }
    });
    app.put("/budgets/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;
        
        // Validate if ID is provided
        if (!id) {
          return res.status(400).send({ success: false, message: "Budget ID is required" });
        }

        // Validate if ID is a valid ObjectId
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ success: false, message: "Invalid budget ID format" });
        }

        // Remove _id from update data if present (to prevent changing the ID)
        delete updateData._id;

        const result = await budgetCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).send({ success: false, message: "Budget not found" });
        }

        res.send({ 
          success: true, 
          message: "Budget updated successfully", 
          data: result 
        });
      } catch (err) {
        res.status(500).send({ success: false, message: "Server error", error: err.message });
      }
    });
    app.patch("/budgets/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = req.body;
        
        if (!id) {
          return res.status(400).send({ success: false, message: "Budget ID is required" });
        }

        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ success: false, message: "Invalid budget ID format" });
        }

        delete updateData._id;

        const result = await budgetCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).send({ success: false, message: "Budget not found" });
        }

        res.send({ 
          success: true, 
          message: "Budget updated successfully", 
          data: result 
        });
      } catch (err) {
        res.status(500).send({ success: false, message: "Server error", error: err.message });
      }
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
  res.send('Server is running')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})