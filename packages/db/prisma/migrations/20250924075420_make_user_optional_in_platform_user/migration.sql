-- DropForeignKey
ALTER TABLE "PlatformUser" DROP CONSTRAINT "PlatformUser_userId_fkey";

-- AlterTable
ALTER TABLE "PlatformUser" ALTER COLUMN "userId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "PlatformUser" ADD CONSTRAINT "PlatformUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
