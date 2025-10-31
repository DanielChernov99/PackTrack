import mongoose from "mongoose";
import Role from "./roleSchema.js"; 

const packerSchema = new mongoose.Schema({
    userID: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    roleID: { type: mongoose.Schema.Types.ObjectId, ref: "Role", required: true },
    hourlyWage: { type: Number, default: 0 },
    bonusForSigmaPack: { type: Number, default: 0 },
    bonusForSportPack: { type: Number, default: 0 },
});

// לפני שמירה, אם זה חדש או roleID השתנה, עדכן את השכר והבונוסים אוטומטית
packerSchema.pre("save", async function(next) {
    if (this.isNew || this.isModified("roleID")) {
        const role = await Role.findById(this.roleID);
        if (role) {
            this.hourlyWage = role.hourlyWage;
            this.bonusForSigmaPack = role.bonusForSigmaPack;
            this.bonusForSportPack = role.bonusForSportPack;
        }
    }
    next();
});

const Packer = mongoose.model("Packer", packerSchema);
export default Packer;
