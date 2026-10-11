const Mentor = require("../models/Mentor");

const verifyMentor = async (req, res) => {
  try {
    const { mentorId } = req.params;

    if (!/^[0-9a-fA-F]{24}$/.test(mentorId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid mentor ID",
      });
    }

    const mentor = await Mentor.findById(mentorId);

    if (!mentor) {
      return res.status(404).json({
        success: false,
        message: "Mentor not found",
      });
    }

    mentor.isVerified = true;
    await mentor.save();

    return res.status(200).json({
      success: true,
      message: "Mentor verified successfully",
      mentor: {
        id: mentor._id,
        userId: mentor.userId,
        isVerified: mentor.isVerified,
      },
    });
  } catch (error) {
    console.error("Verify mentor error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to verify mentor",
    });
  }
};

module.exports = { verifyMentor };