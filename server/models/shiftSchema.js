import mongoose from "mongoose";

const shiftSchema = new mongoose.Schema({
    packerID: { type: mongoose.Schema.Types.ObjectId, ref: "Packer", required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    totalSigmaPacks: { type: Number, required: true },
    totalSportPacks: { type: Number, required: true },
    hourWage: { type: Number, required: true },
    bonusForSigmaPack: { type: Number, required: true },
    bonusForSportPack: { type: Number, required: true },
    isHoliday: { type: Boolean, required: true }
}, { timestamps: true });

const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;
