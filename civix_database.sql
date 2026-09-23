-- =============================================================
-- CIVIX Database Restore Script
-- Generated from: prisma/schema.prisma + all migration files
-- Target: MySQL / MariaDB (XAMPP)
-- =============================================================
-- HOW TO USE:
--   1. Open phpMyAdmin (http://localhost/phpmyadmin)
--   2. Click "Import" tab
--   3. Choose this file and click "Go"
--   OR run via command line:
--   mysql -u root -p < civix_database.sql
-- =============================================================

CREATE DATABASE IF NOT EXISTS `civix`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `civix`;

-- =============================================================
-- TABLE: User
-- =============================================================
CREATE TABLE `User` (
    `id`           VARCHAR(191) NOT NULL,
    `fullName`     VARCHAR(191) NOT NULL,
    `citizenId`    VARCHAR(191) NOT NULL,
    `email`        VARCHAR(191) NOT NULL,
    `gmail`        VARCHAR(191) NULL,
    `mobileNumber` VARCHAR(191) NULL,
    `department`   VARCHAR(191) NULL,
    `avatar`       VARCHAR(191) NULL,
    `password`     VARCHAR(191) NOT NULL,
    `role`         ENUM('CITIZEN','ADMIN','STAFF') NOT NULL DEFAULT 'CITIZEN',
    `createdAt`    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_citizenId_key` (`citizenId`),
    UNIQUE INDEX `User_email_key` (`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: Submission
-- =============================================================
CREATE TABLE `Submission` (
    `id`          VARCHAR(191) NOT NULL,
    `trackingId`  VARCHAR(191) NOT NULL,
    `type`        ENUM('COMPLAINT','SUGGESTION','FEEDBACK') NOT NULL,
    `status`      ENUM('PENDING','REVIEWING','IN_PROGRESS','RESOLVED') NOT NULL DEFAULT 'PENDING',
    `priority`    ENUM('URGENT','STANDARD','LOW') NOT NULL DEFAULT 'STANDARD',
    `description` TEXT NOT NULL,
    `address`     VARCHAR(191) NULL,
    `category`    VARCHAR(191) NOT NULL,
    `department`  VARCHAR(191) NOT NULL DEFAULT 'UNASSIGNED',
    `sentiment`   ENUM('POSITIVE','NEUTRAL','NEGATIVE') NOT NULL DEFAULT 'NEUTRAL',
    `rating`      INTEGER NULL,
    `reaction`    VARCHAR(191) NULL,
    `feedbackTags` TEXT NULL,
    `userId`      VARCHAR(191) NULL,
    `createdAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt`   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Submission_trackingId_key` (`trackingId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: Location
-- =============================================================
CREATE TABLE `Location` (
    `id`           VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `latitude`     DOUBLE NOT NULL,
    `longitude`    DOUBLE NOT NULL,

    UNIQUE INDEX `Location_submissionId_key` (`submissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: Media
-- =============================================================
CREATE TABLE `Media` (
    `id`           VARCHAR(191) NOT NULL,
    `submissionId` VARCHAR(191) NOT NULL,
    `filePath`     VARCHAR(191) NOT NULL,
    `fileType`     VARCHAR(191) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: Notification
-- =============================================================
CREATE TABLE `Notification` (
    `id`        VARCHAR(191) NOT NULL,
    `userId`    VARCHAR(191) NOT NULL,
    `message`   VARCHAR(191) NOT NULL,
    `isRead`    BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: AIClassification
-- =============================================================
CREATE TABLE `AIClassification` (
    `id`                  VARCHAR(191) NOT NULL,
    `submissionId`        VARCHAR(191) NOT NULL,
    `predictedDepartment` VARCHAR(191) NOT NULL,
    `confidence`          DOUBLE NOT NULL,
    `matchedKeywords`     TEXT NOT NULL,
    `citizenSelected`     VARCHAR(191) NULL,
    `adminCorrected`      BOOLEAN NOT NULL DEFAULT false,
    `createdAt`           DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AIClassification_submissionId_key` (`submissionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: DepartmentChangeLog
-- =============================================================
CREATE TABLE `DepartmentChangeLog` (
    `id`             VARCHAR(191) NOT NULL,
    `submissionId`   VARCHAR(191) NOT NULL,
    `trackingId`     VARCHAR(191) NOT NULL,
    `changedById`    VARCHAR(191) NOT NULL,
    `changedByName`  VARCHAR(191) NOT NULL,
    `changedByRole`  VARCHAR(191) NOT NULL,
    `fromDepartment` VARCHAR(191) NOT NULL,
    `toDepartment`   VARCHAR(191) NOT NULL,
    `reason`         VARCHAR(191) NULL,
    `createdAt`      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: SystemSettings
-- =============================================================
CREATE TABLE `SystemSettings` (
    `id`               VARCHAR(191) NOT NULL DEFAULT 'default',
    `organizationName` VARCHAR(191) NOT NULL DEFAULT 'CIVIX',
    `tagline`          VARCHAR(191) NOT NULL DEFAULT 'Integrated Citizen Engagement Platform',
    `contactEmail`     VARCHAR(191) NOT NULL DEFAULT 'admin@civix.gov',
    `contactPhone`     VARCHAR(191) NOT NULL DEFAULT '',
    `officeAddress`    TEXT NOT NULL DEFAULT (''),
    `departmentsJson`  TEXT NOT NULL,
    `updatedAt`        DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- TABLE: _prisma_migrations (Prisma internal tracking)
-- =============================================================
CREATE TABLE IF NOT EXISTS `_prisma_migrations` (
    `id`                  VARCHAR(36) NOT NULL,
    `checksum`            VARCHAR(64) NOT NULL,
    `finished_at`         DATETIME(3) NULL,
    `migration_name`      VARCHAR(255) NOT NULL,
    `logs`                TEXT NULL,
    `rolled_back_at`      DATETIME(3) NULL,
    `started_at`          DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `applied_steps_count` INTEGER UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- =============================================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================================
ALTER TABLE `Submission`
    ADD CONSTRAINT `Submission_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `Location`
    ADD CONSTRAINT `Location_submissionId_fkey`
    FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Media`
    ADD CONSTRAINT `Media_submissionId_fkey`
    FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `Notification`
    ADD CONSTRAINT `Notification_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `AIClassification`
    ADD CONSTRAINT `AIClassification_submissionId_fkey`
    FOREIGN KEY (`submissionId`) REFERENCES `Submission`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- =============================================================
-- SEED DATA
-- =============================================================
-- Default admin:   email=admin@civix.gov    password=admin123
-- Default citizen: email=citizen@test.com   password=citizen123
-- =============================================================

INSERT INTO `User` (`id`, `fullName`, `citizenId`, `email`, `password`, `role`, `createdAt`) VALUES
('clh0000000000000000000001', 'System Administrator', 'ADMIN-0001',   'admin@civix.gov',  '$2a$12$iDezhj4uQkpbC9gQHwa1te92s24OZ8Rm8mvQoNGLj.Z3JMWNXFSRK', 'ADMIN',   NOW()),
('clh0000000000000000000002', 'Juan dela Cruz',       'CIT-2025-001', 'citizen@test.com', '$2a$12$LtDZbU5hEYfX0.7N1zJ1SOb30BPafR8NjN6UDsrK5q5X7yDyhkqo2', 'CITIZEN', NOW());

INSERT INTO `Submission` (`id`, `trackingId`, `type`, `status`, `priority`, `description`, `category`, `department`, `sentiment`, `userId`, `createdAt`, `updatedAt`) VALUES
('clh0000000000000000001001', 'CIVIX-20250515-ABC123', 'COMPLAINT',  'IN_PROGRESS', 'URGENT',   'There is a large pothole on the main road near the market that has been causing accidents. This is dangerous and needs urgent repair.',                                    'Road Maintenance', 'INFRASTRUCTURE', 'NEGATIVE', 'clh0000000000000000000002', NOW(), NOW()),
('clh0000000000000000001002', 'CIVIX-20250516-DEF456', 'SUGGESTION', 'REVIEWING',   'STANDARD', 'It would be great to have more recycling bins placed around the park area to help improve waste management and keep the area clean.',                                   'Waste Management', 'SANITATION',     'POSITIVE', 'clh0000000000000000000002', NOW(), NOW()),
('clh0000000000000000001003', 'CIVIX-20250517-GHI789', 'FEEDBACK',   'RESOLVED',    'LOW',      'The new streetlights installed last week are excellent! The neighborhood feels much safer now at night. Thank you for the quick implementation.',                       'Street Lighting',  'PUBLIC_SAFETY',  'POSITIVE', 'clh0000000000000000000002', NOW(), NOW()),
('clh0000000000000000001004', 'CIVIX-20250517-JKL012', 'COMPLAINT',  'PENDING',     'URGENT',   'Flooding in Barangay 5 after heavy rain. Several houses are already waterlogged and residents need emergency assistance.',                                              'Flooding',         'PUBLIC_SAFETY',  'NEGATIVE', 'clh0000000000000000000002', NOW(), NOW());

INSERT INTO `Location` (`id`, `submissionId`, `latitude`, `longitude`) VALUES
('clh0000000000000000002001', 'clh0000000000000000001001', 14.5995, 120.9842),
('clh0000000000000000002002', 'clh0000000000000000001002', 14.6010, 120.9860),
('clh0000000000000000002003', 'clh0000000000000000001004', 14.5975, 120.9825);

INSERT INTO `Notification` (`id`, `userId`, `message`, `isRead`, `createdAt`) VALUES
('clh0000000000000000003001', 'clh0000000000000000000002', 'Your submission CIVIX-20250515-ABC123 is now in progress.',         false, NOW()),
('clh0000000000000000003002', 'clh0000000000000000000002', 'Your submission CIVIX-20250516-DEF456 is now being reviewed.',       true,  NOW()),
('clh0000000000000000003003', 'clh0000000000000000000002', 'Your submission CIVIX-20250517-GHI789 has been resolved. Thank you!', false, NOW());

INSERT INTO `SystemSettings` (`id`, `organizationName`, `tagline`, `contactEmail`, `contactPhone`, `officeAddress`, `departmentsJson`, `updatedAt`) VALUES
(
  'default',
  'CIVIX',
  'Integrated Citizen Engagement Platform',
  'admin@civix.gov',
  '',
  '',
  '["Mayor\'s Office – CRMO","HR","Tourism","Motorpool","Traffic","CSDO","OSCA","MDRRMO","Municipal Budget Office","Municipal Accountant Office","Municipal Agriculture Office","Municipal Health Office","Municipal Civil Registry Office","Municipal Social Welfare & Development Office","Municipal Economic & Natural Resource Office","Municipal Treasurer Office","Municipal Engineering Office","Municipal Planning & Development Office","Sangguniang Bayan Office","Office of the Vice Mayor"]',
  NOW()
);
