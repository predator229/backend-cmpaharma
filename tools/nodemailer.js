const nodemailer = require('nodemailer');
const { getFirebaseApp } = require('@config/firebase');

const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', 
    port: 587,
    secure: false,
    auth: {
        user: process.env.MAIL_USER, 
        pass: process.env.MAIL_PASS,
    },
});

const createUserAndSendEmailLink = async (email, type, actionUrl) => {
    const firebaseApp = getFirebaseApp(type);
    if (!firebaseApp) {
        throw new Error(`Firebase app not initialized for type: ${type}`);
    }

    try {
        // Créer l'utilisateur sans mot de passe
        const userRecord = await firebaseApp.auth().createUser({
            email,
            emailVerified: false,
        });

        // Générer un lien de création de mot de passe
        const resetLink = await firebaseApp.auth().generatePasswordResetLink(email, {
            url: actionUrl,
            handleCodeInApp: true,
        });

        // Envoyer l’email
        await transporter.sendMail({
            from: `"Support LokaPharms" <${process.env.MAIL_USER}>`,
            to: email,
            subject: 'Activez votre compte LokaPharms',
            html: `
                <p>Bonjour,</p>
                <p>Un compte vient d’être créé pour vous sur <b>LokaPharms</b>.</p>
                <p>Veuillez cliquer sur le bouton ci-dessous pour définir votre mot de passe :</p>
                <p><a href="${resetLink}" style="background-color:#4CAF50;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Créer mon mot de passe</a></p>
                <p>Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet email.</p>
                <p>L’équipe LokaPharms</p>
            `,
        });

        return {
            status: 201,
            message: `User created and email sent to ${email}`,
        };
    } catch (error) {
        return {
            status: 400,
            message: 'Error creating user or sending email',
            error: error.message,
        };
    }
};
