import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"
import { UserRole, AttemptStatus } from "@prisma/client"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    const enrolledStudents = await db.quizUser.findMany({
      where: { quizId: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true
          }
        }
      },
      orderBy: {
        user: {
          name: "asc"
        }
      }
    })

    const formattedStudents = enrolledStudents.map(enrollment => ({
      id: enrollment.user.id,
      name: enrollment.user.name,
      email: enrollment.user.email,
      isActive: enrollment.user.isActive,
      enrolledAt: enrollment.createdAt,
      enrolled: true
    }))

    return NextResponse.json(formattedStudents)
  } catch (error) {
    console.error("Error fetching enrolled students:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session || session.user.role !== UserRole.ADMIN) {
      return NextResponse.json(
        { message: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const { studentIds } = await request.json()

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return NextResponse.json(
        { message: "Student IDs array is required" },
        { status: 400 }
      )
    }

    // Check if quiz exists
    const quiz = await db.quiz.findUnique({
      where: { id }
    })

    if (!quiz) {
      return NextResponse.json(
        { message: "Quiz not found" },
        { status: 404 }
      )
    }

    // Check for existing enrollments to avoid duplicates
    const existingEnrollments = await db.quizUser.findMany({
      where: {
        quizId: id,
        userId: { in: studentIds }
      }
    })

    const enrolledStudentIds = existingEnrollments.map(enrollment => enrollment.userId)
    const newStudentIds = studentIds.filter(id => !enrolledStudentIds.includes(id))

    if (newStudentIds.length === 0) {
      return NextResponse.json(
        { message: "All selected students are already enrolled" },
        { status: 400 }
      )
    }

    // Create quiz enrollments only for new students
    await Promise.all(
      newStudentIds.map(studentId =>
        db.quizUser.create({
          data: {
            userId: studentId,
            quizId: id
          }
        })
      )
    )

    return NextResponse.json({
      message: "Students enrolled successfully",
      enrolledCount: newStudentIds.length,
      alreadyEnrolled: enrolledStudentIds.length
    })
  } catch (error) {
    console.error("Error enrolling students:", error)
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    )
  }
}