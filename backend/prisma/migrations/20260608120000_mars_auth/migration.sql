-- CreateTable
CREATE TABLE "mars_auth" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "refreshToken" TEXT NOT NULL,
    "accessToken" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mars_auth_pkey" PRIMARY KEY ("id")
);
