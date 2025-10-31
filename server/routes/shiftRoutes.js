import express from "express";
import Shift from "../models/shiftSchema.js";
import Packer from "../models/packerSchema.js";

const router = express.Router();

//Create a new shift
router.post("/", async (req, res) => {
    try {
        const { packerID, startTime, endTime, totalSigmaPacks, totalSportPacks, isHoliday } = req.body;

        const packer = await Packer.findById(packerID);
        if (!packer) return res.status(404).json({ message: "Packer not found" });

        const newShift = new Shift({
            packerID,
            startTime,
            endTime,
            totalSigmaPacks,
            totalSportPacks,
            hourWage: packer.hourlyWage,
            bonusForSigmaPack: packer.bonusForSigmaPack,
            bonusForSportPack: packer.bonusForSportPack,
            isHoliday
        });

        await newShift.save();

        const populatedShift = await Shift.findById(newShift._id)
            .populate({
                path: "packerID",
                populate: [
                    { path: "userID", select: "username name" },
                    { path: "roleID", select: "name hourlyWage bonusForSigmaPack bonusForSportPack" }
                ]
            });

        res.status(201).json(populatedShift);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Get all shifts
router.get("/", async (req, res) => {
    try {
        const shifts = await Shift.find()
            .populate({
                path: "packerID",
                populate: [
                    { path: "userID", select: "username name" },
                    { path: "roleID", select: "name hourlyWage bonusForSigmaPack bonusForSportPack" }
                ]
            });
        res.status(200).json(shifts);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Get shift by ID
router.get("/:id", async (req, res) => {
    try {
        const shift = await Shift.findById(req.params.id)
            .populate({
                path: "packerID",
                populate: [
                    { path: "userID", select: "username name" },
                    { path: "roleID", select: "name hourlyWage bonusForSigmaPack bonusForSportPack" }
                ]
            });
        if (!shift) return res.status(404).json({ message: "Shift not found" });
        res.status(200).json(shift);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Update shift by ID 
router.put("/:id", async (req, res) => {
    try {
        const { startTime, endTime, totalSigmaPacks, totalSportPacks, isHoliday } = req.body;
        const updatedShift = await Shift.findByIdAndUpdate(
            req.params.id,
            { startTime, endTime, totalSigmaPacks, totalSportPacks, isHoliday },
            { new: true }
        );

        if (!updatedShift) return res.status(404).json({ message: "Shift not found" });

        const populatedShift = await Shift.findById(updatedShift._id)
            .populate({
                path: "packerID",
                populate: [
                    { path: "userID", select: "username name" },
                    { path: "roleID", select: "name hourlyWage bonusForSigmaPack bonusForSportPack" }
                ]
            });

        res.status(200).json(populatedShift);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

//Delete shift by ID
router.delete("/:id", async (req, res) => {
    try {
        const deletedShift = await Shift.findByIdAndDelete(req.params.id);
        if (!deletedShift) return res.status(404).json({ message: "Shift not found" });
        res.status(200).json({ message: "Shift deleted successfully" });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
