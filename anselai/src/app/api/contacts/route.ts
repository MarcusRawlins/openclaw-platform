import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") || "";
  const type = req.nextUrl.searchParams.get("type") || "";

  const where: any = {};

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  if (type && type !== "ALL") {
    where.type = type;
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  const body = await req.json();

  const { firstName, lastName, email, phone, partnerName, partnerEmail, type, source, instagram, notes } = body;

  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: "firstName, lastName, and email are required" }, { status: 400 });
  }

  try {
    const contact = await prisma.contact.create({
      data: { firstName, lastName, email, phone, partnerName, partnerEmail, type: type || "LEAD", source, instagram, notes },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "A contact with this email already exists" }, { status: 409 });
    }
    throw e;
  }
}
