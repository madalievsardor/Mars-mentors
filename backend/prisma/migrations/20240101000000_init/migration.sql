-- CreateTable
CREATE TABLE "mentor_snapshots" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "mentorName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "groupCount" INTEGER NOT NULL,
    "studentCount" INTEGER NOT NULL,
    "groups" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mentor_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_settings" (
    "id" SERIAL NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "mentorName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "threshold" INTEGER NOT NULL DEFAULT 30,
    "chatId" TEXT NOT NULL DEFAULT '1738593169',

    CONSTRAINT "notification_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alerts" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "mentorName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "oldCount" INTEGER,
    "newCount" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mentor_snapshots_date_mentorId_key" ON "mentor_snapshots"("date", "mentorId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_settings_mentorId_key" ON "notification_settings"("mentorId");
