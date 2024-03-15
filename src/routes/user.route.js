import { Router } from "express";
import { 
    loginUser, 
    logoutUser, 
    registerUser, 
    refreshAccessToken, 
    changeCurrentPassword, 
    getCurrentUser, 
    updateAccountDetails, 
    updateAvatar, 
    updateCoverImage, 
    getUserChannelProfile, 
    getWatchHistory 
} from "../controllers/user.controller.js";
import {upload} from "../middlewares/multer.middelware.js"
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.post("/register", upload.fields([
    {
        name:"avatar",
        maxCount : 1,
    },
    {
        name:"coverImage",
        maxCount : 1,
    }
]) ,  registerUser);

router.post("/login", loginUser);

//secured Route
router.post("/logout", verifyJWT , logoutUser);
router.post("/refresh-token", refreshAccessToken);

router.post("/change-password", verifyJWT, changeCurrentPassword);
router.get("/current-user" , verifyJWT, getCurrentUser);
router.patch("/update-account", verifyJWT, updateAccountDetails);

router.patch("/avatar",verifyJWT, upload.single("avatar") ,updateAvatar);
router.patch("/coverImage", verifyJWT, upload.single("coverImage") ,updateCoverImage);

router.get("/channel/:username", verifyJWT, getUserChannelProfile);
router.get("/history", verifyJWT, getWatchHistory);


export default router;