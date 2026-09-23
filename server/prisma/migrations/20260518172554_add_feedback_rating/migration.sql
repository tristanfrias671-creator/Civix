-- AlterTable
ALTER TABLE `submission` ADD COLUMN `feedbackTags` TEXT NULL,
    ADD COLUMN `rating` INTEGER NULL,
    ADD COLUMN `reaction` VARCHAR(191) NULL;
