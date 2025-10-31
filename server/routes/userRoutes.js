import express from "express";
import User from "../models/userSchema.js";
import bcrypt from "bcrypt";

const router = express.Router();

//Create a new user
router.post("/", async (req, res) => {
    try {
        const { username, password, name } = req.body;

        // הצפנת הסיסמה
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const newUser = new User({ username, passwordHash, name });
        await newUser.save();
        res.status(201).json(newUser);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Get all users
router.get("/", async (req, res) => {
    try {
        const users = await User.find().select("-passwordHash");
        res.status(200).json(users);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Get user by ID
router.get("/:id", async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select("-passwordHash");
        if (!user) return res.status(404).json({ message: "User not found" });
        res.status(200).json(user);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }   
});

//Update user by ID
router.put("/:id", async (req, res) => {
    try {
        const { username, password, name } = req.body;

        const updateFields = { username, name };

        if (password) {
            const saltRounds = 10;
            updateFields.passwordHash = await bcrypt.hash(password, saltRounds);
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.params.id,
            updateFields,
            { new: true, runValidators: true }
        ).select("-passwordHash"); 

        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.status(200).json(updatedUser);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});
//Delete user by ID
router.delete("/:id", async (req, res) => {
    try {
        const deletedUser = await User.findByIdAndDelete(req.params.id);
        if (!deletedUser) return res.status(404).json({ message: "User not found" });
        res.status(200).json({ message: "User deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Export the router
export default router;