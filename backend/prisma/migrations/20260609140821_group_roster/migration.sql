-- CreateTable
CREATE TABLE "group_roster_snapshots" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "groupId" INTEGER NOT NULL,
    "groupName" TEXT NOT NULL,
    "mentorId" INTEGER NOT NULL,
    "mentorName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "students" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "group_roster_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "group_roster_snapshots_date_groupId_key" ON "group_roster_snapshots"("date", "groupId");
