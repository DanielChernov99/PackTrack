import express from "express";
import Role from "../models/roleSchema.js";

const router = express.Router();
//Create a new role
router.post("/", async (req, res) => {
    try {
        const { rolename, hourlyWage, bonusForSigmaPack, bonusForSportPack } = req.body;
        const newRole = new Role({ rolename, hourlyWage, bonusForSigmaPack, bonusForSportPack });
        await newRole.save();
        res.status(201).json(newRole);
    }  
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
//Get all roles
router.get("/", async (req, res) => {
    try {
        const roles = await Role.find();
        res.status(200).json(roles);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
//Get role by ID
router.get("/:id", async (req, res) => {
    try {
        const role = await Role.findById(req.params.id);
        if (!role) return res.status(404).json({ message: "Role not found" });
        res.status(200).json(role);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }   
});
//Update role by ID
router.put("/:id", async (req, res) => { 
    try {
        const { rolename, hourlyWage, bonusForSigmaPack, bonusForSportPack } = req.body;
        const updatedRole = await Role.findByIdAndUpdate(
            req.params.id,
            { rolename, hourlyWage, bonusForSigmaPack, bonusForSportPack },
            { new: true }   
        );
        if (!updatedRole) return res.status(404).json({ message: "Role not found" });
        res.status(200).json(updatedRole);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});
//Delete role by ID
router.delete("/:id", async (req, res) => {
    try {
        const deletedRole = await Role.findByIdAndDelete(req.params.id);
        if (!deletedRole) return res.status(404).json({ message: "Role not found" });
        res.status(200).json({ message: "Role deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Export the router
export default router;