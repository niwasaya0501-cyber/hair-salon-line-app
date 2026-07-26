-- CreateTable
CREATE TABLE "DifyConversation" (
    "lineUserId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DifyConversation_pkey" PRIMARY KEY ("lineUserId")
);
