CREATE TABLE IF NOT EXISTS "RoomReview" (
  "id" TEXT NOT NULL,
  "roomId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoomReview_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoomReview_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoomReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoomReview_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5)
);

CREATE UNIQUE INDEX IF NOT EXISTS "RoomReview_roomId_userId_key" ON "RoomReview"("roomId", "userId");
CREATE INDEX IF NOT EXISTS "RoomReview_roomId_createdAt_idx" ON "RoomReview"("roomId", "createdAt");
CREATE INDEX IF NOT EXISTS "RoomReview_userId_createdAt_idx" ON "RoomReview"("userId", "createdAt");
