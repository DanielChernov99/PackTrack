import mongoose from "mongoose";

const roleSchema = new mongoose.Schema({
  rolename: { type: String, required: true, unique: true },  // "new packer", "packer", "checker"
  hourlyWage: { type: Number, required: true },
  bonusForSigmaPack: { type: Number, required: true },
  bonusForSportPack: { type: Number, required: true },
});

const Role = mongoose.model("Role", roleSchema);
export default Role;