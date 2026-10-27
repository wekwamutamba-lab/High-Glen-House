-- CreateTable
CREATE TABLE "setup_status" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) WITH TIME ZONE NOT NULL DEFAULT now(),
    "completed_at" TIMESTAMP(6) WITH TIME ZONE,

    CONSTRAINT "setup_status_pkey" PRIMARY KEY ("id")
);