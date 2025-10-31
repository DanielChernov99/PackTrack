import express from "express";
import Packer from "../models/packerSchema.js";

const router = express.Router();

//Create a new packer
router.post("/", async (req, res) => {
    try {
        const { userID, roleID } = req.body;
        const newPacker = new Packer({ userID, roleID });
        await newPacker.save();
        const populatedPacker = await Packer.findById(newPacker._id)
            .populate("userID", "username name")
            .populate("roleID", "name hourlyWage bonusForSigmaPack bonusForSportPack");
        res.status(201).json(populatedPacker);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Get all packers
router.get("/", async (req, res) => {
    try {
        const packers = await Packer.find()
            .populate("userID", "username name")
            .populate("roleID", "name hourlyWage bonusForSigmaPack bonusForSportPack");
        res.status(200).json(packers);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Get packer by ID
router.get("/:id", async (req, res) => {
    try {
        const packer = await Packer.findById(req.params.id)
            .populate("userID", "username name")
            .populate("roleID", "name hourlyWage bonusForSigmaPack bonusForSportPack");
        if (!packer) return res.status(404).json({ message: "Packer not found" });
        res.status(200).json(packer);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Update packer role (hourlyWage and bonuses auto-updated)
router.put("/:id", async (req, res) => {
    try {
        const { roleID } = req.body;

        const packer = await Packer.findById(req.params.id);
        if (!packer) return res.status(404).json({ message: "Packer not found" });

        // עדכון roleID יחולל pre("save") שמחשב את השכר והבונוסים
        packer.roleID = roleID;
        await packer.save();

        const updatedPacker = await Packer.findById(packer._id)
            .populate("userID", "username name")
            .populate("roleID", "name hourlyWage bonusForSigmaPack bonusForSportPack");

        res.status(200).json(updatedPacker);
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Delete packer by ID
router.delete("/:id", async (req, res) => {
    try {
        const deletedPacker = await Packer.findByIdAndDelete(req.params.id);
        if (!deletedPacker) return res.status(404).json({ message: "Packer not found" });
        res.status(200).json({ message: "Packer deleted successfully" });
    }
    catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
