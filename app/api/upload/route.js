import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { db } from "@/lib/prisma";

export async function POST(request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const formData = await request.formData();
    const file = formData.get("file");
    const applicationId = formData.get("applicationId");

    if (!file || !applicationId) {
      return new NextResponse("Missing file or application ID", { status: 400 });
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "application/msword", 
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    
    if (!allowedTypes.includes(file.type)) {
      return new NextResponse("Only PDF/DOC/DOCX files allowed", { status: 400 });
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return new NextResponse("File size must be less than 10MB", { status: 400 });
    }

    // For Neon DB, we'll use base64 encoding for small files
    // In production, you would use S3/R2, but this works for demo
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64File = buffer.toString("base64");

    // Create attachment record
    const attachment = await db.resumeAttachment.create({
      data: {
        userId,
        applicationId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64File,
      },
    });

    // Update job application with attachment ID
    await db.jobApplication.update({
      where: { id: applicationId },
      data: {
        attachmentId: attachment.id,
        attachmentName: file.name,
      },
    });

    return NextResponse.json({ 
      success: true, 
      attachmentId: attachment.id,
      fileName: file.name 
    });

  } catch (error) {
    console.error("Upload error:", error);
    return new NextResponse("Upload failed", { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { userId } = await auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get("id");

    if (!attachmentId) {
      return new NextResponse("Missing attachment ID", { status: 400 });
    }

    // Delete attachment
    await db.resumeAttachment.delete({
      where: { id: attachmentId, userId },
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Delete attachment error:", error);
    return new NextResponse("Delete failed", { status: 500 });
  }
}