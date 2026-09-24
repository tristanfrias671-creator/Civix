-- CreateTable
CREATE TABLE `SystemSettings` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default',
    `organizationName` VARCHAR(191) NOT NULL DEFAULT 'CIVIX',
    `tagline` VARCHAR(191) NOT NULL DEFAULT 'Integrated Citizen Engagement Platform',
    `contactEmail` VARCHAR(191) NOT NULL DEFAULT 'admin@civix.gov',
    `contactPhone` VARCHAR(191) NOT NULL DEFAULT '',
    `officeAddress` VARCHAR(500) NOT NULL DEFAULT '',
    `departmentsJson` TEXT NOT NULL,
    `categoriesJson` TEXT NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
