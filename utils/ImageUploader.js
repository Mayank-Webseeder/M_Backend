
const fileupload = require("express-fileupload");
const path = require("path");
const fs = require("fs");

// exports.localFileUpload = async (files) => {
//     try {
//         const filesArray = Array.isArray(files) ? files : [files];

//         const uploadDir = path.join(__dirname, "../uploads");

//         // Create upload directory if it doesn't exist
//         if (!fs.existsSync(uploadDir)) {
//             fs.mkdirSync(uploadDir, { recursive: true });
//         }

//         const uploadResults = await Promise.all(
//             filesArray.map((file) => {
//                 return new Promise((resolve, reject) => {
//                     const uploadPath = path.join(uploadDir, file.name);
//                     const relativePath = `/uploads/${file.name}`;
//                     const ext = path.extname(file.name);

//                     file.mv(uploadPath, (err) => {
//                         if (err) return reject(err);
//                         resolve({
//                             path: relativePath,
//                             filename: file.name,
//                             size: file.size,
//                             type: file.mimetype,
//                             extension: ext,
//                             uploadedAt: new Date()
//                         });
//                     });
//                 });
//             })
//         );

//         return uploadResults;

//     } catch (error) {
//         console.error("File upload failed:", error.message);
//         throw new Error("File upload failed: " + error.message);
//     }
// };

exports.localFileUpload = async (files) => {
    try {
        const filesArray = Array.isArray(files) ? files : [files];
        const uploadDir = path.join(__dirname, "../uploads");

        // Create upload directory if it doesn't exist
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        console.log(`Starting local upload of ${filesArray.length} files`);

        const uploadResults = await Promise.all(
            filesArray.map((file, index) => {
                return new Promise((resolve, reject) => {
                    // Generate unique filename to prevent conflicts
                    const timestamp = Date.now();
                    const randomNum = Math.floor(Math.random() * 10000);
                    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_'); // Sanitize filename
                    // const uniqueFileName = `${timestamp}_${randomNum}_${index}_${sanitizedName}`;
                    // const uploadPath = path.join(uploadDir, uniqueFileName);
                    // const relativePath = `/uploads/${uniqueFileName}`;
                    const uploadPath = path.join(uploadDir, file.name);
                    const relativePath = `/uploads/${file.name}`;

                    const ext = path.extname(file.name);

                    // Check if file size is reasonable (optional warning)
                    if (file.size > 100 * 1024 * 1024) { // 100MB warning
                        console.log(`Warning: Large file detected - ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
                    }

                    // Move file with better error handling
                    file.mv(uploadPath, (err) => {
                        if (err) {
                            console.error(`Failed to upload file ${file.name}:`, err);
                            return reject(new Error(`Failed to upload ${file.name}: ${err.message}`));
                        }

                        // Verify file was actually created
                        if (!fs.existsSync(uploadPath)) {
                            return reject(new Error(`File ${file.name} was not created properly`));
                        }

                        resolve({
                            path: relativePath,
                            filename: file.name,
                            // uniqueFileName: uniqueFileName,
                            size: file.size,
                            type: file.mimetype,
                            extension: ext,
                            uploadedAt: new Date(),
                            fullPath: uploadPath
                        });
                    });
                });
            })
        );

        console.log(`Successfully uploaded ${uploadResults.length} files locally`);

        // Log total size uploaded
        const totalSize = uploadResults.reduce((sum, file) => sum + file.size, 0);
        console.log(`Total upload size: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);

        return uploadResults;

    } catch (error) {
        console.error("Local file upload failed:", error.message);
        throw new Error("Local file upload failed: " + error.message);
    }
};