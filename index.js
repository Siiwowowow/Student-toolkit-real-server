const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const port = process.env.PORT || 3000;
require('dotenv').config();
const OpenAI = require("openai").default;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const app = express();


// ===== CORS =====
const corsOptions = {
  origin: ['http://localhost:5174', 'https://student-toolkit-17af6.web.app'],
  credentials: true, // allow cookies
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ===== MongoDB =====
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ikrarq7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// ===== JWT Middleware =====
const logger=(req,res,next)=>{
  console.log('inside the token middle ware')
  next()
}

const verifyToken = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).send({ success: false, message: "Unauthorized" });

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ success: false, message: "Forbidden" });
    req.decoded = decoded;
    next();
  });
};

// ===== Routes =====
async function run() {
  try {
    const db = client.db("CollageDB");
    const usersCollection = db.collection("users");
    const classesCollection = db.collection("class");
    const budgetCollection = db.collection("budgets");
    const studyTasksCollection = db.collection("tasks");
    const questionsCollection = db.collection("questions");

    // JWT route
    app.post("/jwt", (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).send({ success: false, message: "Email required" });

      const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      });
      res.send({ success: true, token });
    });

    // Get all classes
    app.get("/class", async (req, res) => {
      const { email } = req.query;
      let query = {};
      if (!email==req.decoded.email) {
      return res.status(400).send({ 
        success: false, 
        message: "Email is required and must match the token email"
      });   
      }
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

    // Get all budgets
    app.get("/budgets", verifyToken,logger, async (req, res) => {
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
    //studyTasks api
    app.get("/tasks",logger,verifyToken, async (req, res) => {
      try {
        const { email } = req.query;
        
        if (!email==req.decoded.email) {
          return res.status(400).send({ 
            success: false, 
            message: "Email is required and must match the token email"
          });
        }
        const tasks = await studyTasksCollection.find({ email }).toArray();
        res.send({ 
          success: true, 
          data: tasks 
        });
      } catch (err) {
        console.error("Error fetching tasks:", err);
        res.status(500).send({ 
          success: false, 
          message: "Server error while fetching tasks",
          error: err.message 
        });
      }
    });
    app.post("/tasks", async (req, res) => {
      try {
        const { email } = req.body;
        if (!email) {
          return res.status(400).send({ 
            success: false, 
            message: "Email is required" 
          });
        }
        
        const task = { 
          ...req.body, 
          createdAt: new Date(), 
          completed: false 
        };
        
        const result = await studyTasksCollection.insertOne(task);
        res.send({ 
          success: true, 
          data: { ...task, _id: result.insertedId } 
        });
      } catch (err) {
        console.error("Error creating task:", err);
        res.status(500).send({ 
          success: false, 
          message: "Server error", 
          error: err.message 
        });
      }
    });
     
    app.put("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { email } = req.body;
        
        if (!email) {
          return res.status(400).send({ 
            success: false, 
            message: "Email is required" 
          });
        }
        
        const updateData = { ...req.body };
        delete updateData.email; // Remove email from update data
        
        const result = await studyTasksCollection.updateOne(
          { _id: new ObjectId(id), email: email }, 
          { $set: updateData }
        );
        
        if (result.matchedCount === 0) {
          return res.status(404).send({ 
            success: false, 
            message: "Task not found or unauthorized" 
          });
        }
        
        // Get the updated task to return
        const updatedTask = await studyTasksCollection.findOne({ 
          _id: new ObjectId(id), 
          email: email 
        });
        
        res.send({ 
          success: true, 
          data: updatedTask 
        });
      } catch (err) {
        console.error("Error updating task:", err);
        res.status(500).send({ 
          success: false, 
          message: "Server error", 
          error: err.message 
        });
      }
    });
    
    app.delete("/tasks/:id", async (req, res) => {
      try {
        const { id } = req.params;
        const { email } = req.query;
        
        if (!email) {
          return res.status(400).send({ 
            success: false, 
            message: "Email is required" 
          });
        }
        
        const result = await studyTasksCollection.deleteOne({ 
          _id: new ObjectId(id), 
          email: email 
        });
        
        if (result.deletedCount === 0) {
          return res.status(404).send({ 
            success: false, 
            message: "Task not found or unauthorized" 
          });
        }
        
        res.send({ 
          success: true, 
          message: "Task deleted successfully" 
        });
      } catch (err) {
        console.error("Error deleting task:", err);
        res.status(500).send({ 
          success: false, 
          message: "Server error", 
          error: err.message 
        });
      }
    });
    //questions api
    app.post("/ai-chat", async (req, res) => {
      try {
        const { message } = req.body;
        if (!message) return res.status(400).send({ success: false, error: "Message is required" });

        // Fetch current classes dynamically
        const classes = await classesCollection.find().toArray();

        // System prompt with website info
        const systemPrompt = `
          You are a helpful AI assistant for AcademiaX.
          Website features:
          - Users: register/login
          - Classes: ${classes.map(c => c.name).join(", ")}
          - Budget management
          - Study planner
          - AI question generator
          Always answer questions about the website politely and helpfully.
        `;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: message }
          ],
          temperature: 0.6,
          max_tokens: 300
        });

        const reply = response.choices[0].message.content;
        res.send({ success: true, reply });

      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false, error: err.message });
      }
    });

    app.post("/generate-questions", async (req, res) => {
      try {
        const { topic } = req.body;
        if (!topic) return res.status(400).send({ success: false, error: "Topic required" });

        const system = `You are an exam generator. Return STRICT JSON:
        { "mcq":[{"question":string,"options":[string,string,string,string],"correct":string}],
          "trueFalse":[{"question":string,"answer":boolean}],
          "short":[{"question":string,"answer":string}]}`;

        const user = `Generate 5 MCQs, 5 True/False, 5 Short Answer for Topic: "${topic}"`;

        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
          temperature: 0.4,
          max_tokens: 1200,
          response_format: { type: "json_object" },
        });

        const data = JSON.parse(response.choices[0].message.content);
        await questionsCollection.insertOne({ topic, questions: data, createdAt: new Date() });
        res.send({ success: true, data });
      } catch (err) {
        res.status(500).send({ success: false, error: err.message || "Server error" });
      }
    });
   //users api
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

    
    




    await client.db("admin").command({ ping: 1 });
    console.log("MongoDB connected!");
  } finally {
    // Keep connection alive
  }
}

run().catch(console.dir);
app.get('/', (req, res) => {
  res.send('Server is running from Student Toolkit')
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
