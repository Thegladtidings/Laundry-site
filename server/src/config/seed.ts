import mongoose from 'mongoose';
import dotenv   from 'dotenv';
import User     from '../models/user.js';

dotenv.config();

const users = [
    { firstname: 'Abdullah',  lastname: 'Al-Rashid',  username: 'abdullahrashid',  email: 'abdullah.rashid@email.com',  phone: '08010000001' },
    { firstname: 'Fatimah',   lastname: 'Al-Zahra',   username: 'fatimahzahra',    email: 'fatimah.zahra@email.com',    phone: '08010000002' },
    { firstname: 'Muhammad',  lastname: 'Ibn-Yusuf',  username: 'muhammadibn',     email: 'muhammad.yusuf@email.com',   phone: '08010000003' },
    { firstname: 'Aisha',     lastname: 'Al-Siddiq',  username: 'aishasiddiq',     email: 'aisha.siddiq@email.com',     phone: '08010000004' },
    { firstname: 'Omar',      lastname: 'Al-Farouq',  username: 'omarfarouq',      email: 'omar.farouq@email.com',      phone: '08010000005' },
    { firstname: 'Khadijah',  lastname: 'Al-Kubra',   username: 'khadijahkubra',   email: 'khadijah.kubra@email.com',   phone: '08010000006' },
    { firstname: 'Ali',       lastname: 'Ibn-Talib',  username: 'aliibntalib',     email: 'ali.talib@email.com',        phone: '08010000007' },
    { firstname: 'Maryam',    lastname: 'Al-Noor',    username: 'maryamnoor',      email: 'maryam.noor@email.com',      phone: '08010000008' },
    { firstname: 'Ibrahim',   lastname: 'Al-Khalil',  username: 'ibrahimkhalil',   email: 'ibrahim.khalil@email.com',   phone: '08010000009' },
    { firstname: 'Zainab',    lastname: 'Al-Husain',  username: 'zainabhusain',    email: 'zainab.husain@email.com',    phone: '08010000010' },
    { firstname: 'Yusuf',     lastname: 'Al-Siddiq',  username: 'yusufsiddiq',     email: 'yusuf.siddiq@email.com',     phone: '08010000011' },
    { firstname: 'Safiyyah',  lastname: 'Al-Ansari',  username: 'safiyyahansari',  email: 'safiyyah.ansari@email.com',  phone: '08010000012' },
    { firstname: 'Hassan',    lastname: 'Al-Basri',   username: 'hassanbasri',     email: 'hassan.basri@email.com',     phone: '08010000013' },
    { firstname: 'Ruqayyah',  lastname: 'Al-Madani',  username: 'ruqayyahmadani',  email: 'ruqayyah.madani@email.com',  phone: '08010000014' },
    { firstname: 'Hussain',   lastname: 'Al-Karimi',  username: 'hussainkarimi',   email: 'hussain.karimi@email.com',   phone: '08010000015' },
    { firstname: 'Asma',      lastname: 'Al-Bakr',    username: 'asmabakr',        email: 'asma.bakr@email.com',        phone: '08010000016' },
    { firstname: 'Bilal',     lastname: 'Al-Habashi', username: 'bilalhabashi',    email: 'bilal.habashi@email.com',    phone: '08010000017' },
    { firstname: 'Sumayya',   lastname: 'Al-Ammar',   username: 'sumayyaammar',    email: 'sumayya.ammar@email.com',    phone: '08010000018' },
    { firstname: 'Salman',    lastname: 'Al-Farisi',  username: 'salmanfarisi',    email: 'salman.farisi@email.com',    phone: '08010000019' },
    { firstname: 'Hafsa',     lastname: 'Al-Umar',    username: 'hafsaumar',       email: 'hafsa.umar@email.com',       phone: '08010000020' },
    { firstname: 'Khalid',    lastname: 'Ibn-Walid',  username: 'khalidwalid',     email: 'khalid.walid@email.com',     phone: '08010000021' },
    { firstname: 'Umm-Kulthum',lastname: 'Al-Hashim', username: 'ummkulthum',      email: 'umm.kulthum@email.com',      phone: '08010000022' },
    { firstname: 'Tariq',     lastname: 'Ibn-Ziyad',  username: 'tariqziyad',      email: 'tariq.ziyad@email.com',      phone: '08010000023' },
    { firstname: 'Aminah',    lastname: 'Al-Wahab',   username: 'aminahwahab',     email: 'aminah.wahab@email.com',     phone: '08010000024' },
    { firstname: 'Usman',     lastname: 'Al-Ghani',   username: 'usmanganghani',   email: 'usman.ghani@email.com',      phone: '08010000025' },
    { firstname: 'Lubna',     lastname: 'Al-Qasim',   username: 'lubnaqasim',      email: 'lubna.qasim@email.com',      phone: '08010000026' },
    { firstname: 'Muadh',     lastname: 'Ibn-Jabal',  username: 'muadhjabal',      email: 'muadh.jabal@email.com',      phone: '08010000027' },
    { firstname: 'Sawdah',    lastname: 'Al-Zama',    username: 'sawdahzama',      email: 'sawdah.zama@email.com',      phone: '08010000028' },
    { firstname: 'Ammar',     lastname: 'Ibn-Yasir',  username: 'ammaryasir',      email: 'ammar.yasir@email.com',      phone: '08010000029' },
    { firstname: 'Nusaybah',  lastname: 'Al-Mazin',   username: 'nusaybahmazin',   email: 'nusaybah.mazin@email.com',   phone: '08010000030' },
];

const seedUsers = async (): Promise<void> => {
    try {
        await mongoose.connect(process.env.MONGO_URI!, {
            dbName: 'laundrydb',
        });
        console.log('✅ Connected to MongoDB');

        for (const userData of users) {
            // Check if user already exists
            const exists = await User.findOne({ email: userData.email });
            if (exists) {
                console.log(`⏭️  Skipping ${userData.firstname} — already exists`);
                continue;
            }

            // Only insert if user doesn't exist
            await User.create({
                ...userData,
                password: 'password123',
                role:     'user'
            });
            console.log(`✅ Created ${userData.firstname}`);
        }

        console.log('✅ Seeding complete');
        process.exit(0);

    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    }
};

seedUsers();