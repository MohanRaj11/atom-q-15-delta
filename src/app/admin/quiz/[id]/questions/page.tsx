"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import {
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  GripVertical,
  Search,
  Plus,
  ArrowLeft,
  Edit,
  Trash2,
  Eye,
  X,
  Download,
  Upload,
  ChevronLeft,
  FileDown,
  FileUp
} from "lucide-react"
import { toast } from "sonner"
import { QuestionType, DifficultyLevel } from "@prisma/client"
import Papa from "papaparse"
import HexagonLoader from "@/components/Loader/Loading"

interface Question {
  id: string
  title: string
  content: string
  type: QuestionType
  options: string[] | string
  correctAnswer: string
  explanation?: string
  difficulty: DifficultyLevel
  isActive: boolean
  order: number
  points: number
}

interface AvailableQuestion {
  id: string
  title: string
  content: string
  type: QuestionType
  options: string[] | string
  correctAnswer: string
  explanation?: string
  difficulty: DifficultyLevel
  isActive: boolean
  group?: {
    id: string
    name: string
  }
}

interface QuestionGroup {
  id: string
  name: string
  description: string | null
  isActive: boolean
  _count: {
    questions: number
  }
}

function SortableQuestion({
  question,
  onEdit,
  onDelete,
  onView
}: {
  question: Question
  onEdit: (question: Question) => void
  onDelete: (questionId: string) => void
  onView: (question: Question) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: question.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes}>
      <TableCell>
        <div {...listeners} className="cursor-grab">
          <GripVertical className="h-4 w-4" />
        </div>
      </TableCell>
      <TableCell className="font-medium">{question.order}</TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{question.title}</div>
          <div className="text-sm text-muted-foreground">
            {question.content}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant={
          question.type === QuestionType.MULTIPLE_CHOICE ? "default" :
            question.type === QuestionType.MULTI_SELECT ? "secondary" :
            question.type === QuestionType.TRUE_FALSE ? "outline" : "destructive"
        }>
          {question.type.replace('_', ' ')}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge variant={
          question.difficulty === DifficultyLevel.EASY ? "default" :
            question.difficulty === DifficultyLevel.MEDIUM ? "secondary" : "destructive"
        }>
          {question.difficulty}
        </Badge>
      </TableCell>
      <TableCell>{question.points}</TableCell>
      <TableCell>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onView(question)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(question)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove Question</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove this question from the quiz? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(question.id)}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </TableCell>
    </TableRow>
  )
}

export default function QuizQuestionsPage() {
  const params = useParams()
  const router = useRouter()
  const quizId = params.id as string

  const [questions, setQuestions] = useState<Question[]>([])
  const [availableQuestions, setAvailableQuestions] = useState<AvailableQuestion[]>([])
  const [questionGroups, setQuestionGroups] = useState<QuestionGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("all")
  const [groupFilter, setGroupFilter] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState<Question | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [quizTitle, setQuizTitle] = useState("")
  const [selectedQuestionsToAdd, setSelectedQuestionsToAdd] = useState<string[]>([])
  const [createFormData, setCreateFormData] = useState({
    title: "",
    content: "",
    type: "MULTIPLE_CHOICE" as QuestionType,
    options: ["", ""],
    correctAnswer: "",
    explanation: "",
    difficulty: "MEDIUM" as DifficultyLevel,
    points: 1.0
  })
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    fetchQuiz()
    fetchQuestions()
    fetchAvailableQuestions()
    fetchQuestionGroups()
  }, [quizId])

  useEffect(() => {
    fetchAvailableQuestions()
  }, [difficultyFilter, searchTerm, groupFilter])

  const fetchQuiz = async () => {
    try {
      const response = await fetch(`/api/admin/quiz/${quizId}`)
      if (response.ok) {
        const data = await response.json()
        setQuizTitle(data.title)
      }
    } catch (error) {
      console.error("Failed to fetch quiz title:", error)
    }
  }

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`/api/admin/quiz/${quizId}/questions`)
      if (response.ok) {
        const data = await response.json()
        setQuestions(data)
      }
    } catch (error) {
      toast.error("Failed to fetch questions")
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableQuestions = async () => {
    try {
      const params = new URLSearchParams()
      if (difficultyFilter !== "all") params.append("difficulty", difficultyFilter)
      if (searchTerm) params.append("search", searchTerm)
      if (groupFilter !== "all") params.append("groupId", groupFilter)
      
      const response = await fetch(`/api/admin/quiz/${quizId}/available-questions?${params}`)
      if (response.ok) {
        const data = await response.json()
        setAvailableQuestions(data)
      }
    } catch (error) {
      toast.error("Failed to fetch available questions")
    }
  }

  const fetchQuestionGroups = async () => {
    try {
      const response = await fetch("/api/admin/question-groups")
      if (response.ok) {
        const data = await response.json()
        setQuestionGroups(data)
      }
    } catch (error) {
      console.error("Failed to fetch question groups:", error)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id)
      const newIndex = questions.findIndex(q => q.id === over?.id)

      const newQuestions = arrayMove(questions, oldIndex, newIndex)
      setQuestions(newQuestions)

      // Update order in backend
      try {
        await fetch(`/api/admin/quiz/${quizId}/questions/reorder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            questionOrders: newQuestions.map((q, index) => ({
              questionId: q.id,
              order: index + 1
            }))
          }),
        })
      } catch (error) {
        toast.error("Failed to update question order")
        fetchQuestions() // Revert to original order
      }
    }
  }

  const handleRemoveQuestion = async (questionId: string) => {
    try {
      const response = await fetch(`/api/admin/quiz/${quizId}/questions/${questionId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setQuestions(questions.filter(q => q.id !== questionId))
        toast.success("Question removed from quiz")
        setDeleteQuestionId(null)
      } else {
        toast.error("Failed to remove question")
      }
    } catch (error) {
      toast.error("Failed to remove question")
    }
  }

  const handleAddQuestions = async (questionIds: string[]) => {
    if (questionIds.length === 0) return
    
    try {
      const response = await fetch(`/api/admin/quiz/${quizId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ questionIds }),
      })

      if (response.ok) {
        toast.success("Questions added to quiz")
        setIsAddDialogOpen(false)
        setSelectedQuestionsToAdd([])
        fetchQuestions()
        fetchAvailableQuestions()
      } else {
        toast.error("Failed to add questions")
      }
    } catch (error) {
      toast.error("Failed to add questions")
    }
  }

  const handleCreateQuestion = async () => {
    try {
      const response = await fetch(`/api/admin/quiz/${quizId}/questions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...createFormData,
          options: createFormData.options.filter(opt => opt.trim() !== "")
        }),
      })

      if (response.ok) {
        toast.success("Question created and added to quiz")
        setIsCreateDialogOpen(false)
        setCreateFormData({
          title: "",
          content: "",
          type: "MULTIPLE_CHOICE" as QuestionType,
          options: ["", ""],
          correctAnswer: "",
          explanation: "",
          difficulty: "MEDIUM" as DifficultyLevel,
          points: 1.0
        })
        fetchQuestions()
        fetchAvailableQuestions()
      } else {
        const error = await response.json()
        toast.error(error.message || "Failed to create question")
      }
    } catch (error) {
      toast.error("Failed to create question")
    }
  }

  const handleExportQuestions = () => {
    const csvContent = [
      ["Title", "Content", "Type", "Options", "Correct Answer", "Explanation", "Difficulty", "Points"],
      ...questions.map(question => {
        // Parse options from database (stored as JSON string) and convert to pipe-separated format
        let optionsString = ""
        try {
          const parsedOptions = Array.isArray(question.options)
            ? question.options
            : JSON.parse(question.options || "[]")
          optionsString = parsedOptions.join("|")
        } catch (e) {
          console.warn("Failed to parse options for question:", question.title, e)
          optionsString = question.options?.toString() || ""
        }

        return [
          question.title,
          question.content,
          question.type,
          optionsString,
          question.correctAnswer,
          question.explanation || "",
          question.difficulty,
          question.points.toString()
        ]
      })
    ].map(row =>
      // Properly escape CSV values that contain commas or quotes
      row.map(cell => {
        if (cell === null || cell === undefined) return ""
        const str = cell.toString()
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`
        }
        return str
      }).join(",")
    ).join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${quizTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_questions.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success("Questions exported to CSV")
  }

  const handleImportQuestions = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          console.log("CSV parsing results:", results)

          // Filter out empty rows and validate required fields
          const validQuestions = results.data.filter((row: any) => {
            const hasTitle = row.Title && row.Title.trim() !== ""
            const hasContent = row.Content && row.Content.trim() !== ""
            const hasType = row.Type && row.Type.trim() !== ""
            const hasOptions = row.Options && row.Options.trim() !== ""
            const hasCorrectAnswer = row["Correct Answer"] && row["Correct Answer"].trim() !== ""

            return hasTitle && hasContent && hasType && hasOptions && hasCorrectAnswer
          })

          console.log("Valid questions found:", validQuestions.length)

          if (validQuestions.length === 0) {
            toast.error("No valid questions found in CSV file. Please ensure all required fields are filled.")
            return
          }

          const importPromises = validQuestions.map(async (question: any, index: number) => {
            try {
              console.log(`Processing question ${index + 1}:`, question)

              // Normalize question type
              let questionType = question.Type?.toString().toUpperCase().trim()
              if (!Object.values(QuestionType).includes(questionType as QuestionType)) {
                // Default to MULTIPLE_CHOICE if type is invalid
                questionType = QuestionType.MULTIPLE_CHOICE
                console.warn(`Invalid question type "${question.Type}", defaulting to MULTIPLE_CHOICE`)
              }

              // Parse options with better error handling
              let options = []
              if (question.Options) {
                const optionsStr = question.Options.toString().trim()

                // Try to parse as JSON first (handles ["aa","bb","cc"] format)
                if (optionsStr.startsWith('[') && optionsStr.endsWith(']')) {
                  try {
                    const parsed = JSON.parse(optionsStr)
                    if (Array.isArray(parsed)) {
                      options = parsed.map(opt => opt.toString().trim()).filter(opt => opt.length > 0)
                    }
                  } catch (e) {
                    console.warn(`Failed to parse options as JSON for question "${question.Title}":`, e)
                  }
                }

                // If JSON parsing failed or not JSON, try different delimiters
                if (options.length === 0) {
                  // Try pipe delimiter first
                  if (optionsStr.includes('|')) {
                    options = optionsStr.split('|').map(opt => opt.trim()).filter(opt => opt.length > 0)
                  }
                  // Try comma delimiter
                  else if (optionsStr.includes(',')) {
                    options = optionsStr.split(',').map(opt => opt.trim()).filter(opt => opt.length > 0)
                  }
                  // Try semicolon delimiter
                  else if (optionsStr.includes(';')) {
                    options = optionsStr.split(';').map(opt => opt.trim()).filter(opt => opt.length > 0)
                  }
                  // Single option as string
                  else if (optionsStr.length > 0) {
                    options = [optionsStr]
                  }
                }
              }

              console.log(`Parsed options for "${question.Title}":`, options)
              console.log(`Options length: ${options.length}, Options array:`, options)

              // Ensure True/False questions have correct options
              if (questionType === QuestionType.TRUE_FALSE) {
                if (options.length !== 2 || !options.includes("True") || !options.includes("False")) {
                  options = ["True", "False"]
                  console.log(`Standardized True/False options for "${question.Title}"`)
                }
              }

              // Validate options for multiple choice
              if (questionType === QuestionType.MULTIPLE_CHOICE && options.length < 2) {
                throw new Error(`Multiple choice question "${question.Title}" must have at least 2 options`)
              }

              // Normalize correct answer
              const correctAnswer = question["Correct Answer"]?.toString().trim()
              if (!correctAnswer) {
                throw new Error(`Correct answer is required for question "${question.Title}"`)
              }

              // Validate that correct answer is in options
              if (!options.includes(correctAnswer)) {
                throw new Error(`Correct answer "${correctAnswer}" not found in options for question "${question.Title}"`)
              }

              // Normalize difficulty
              let difficulty = question.Difficulty?.toString().toUpperCase().trim() || DifficultyLevel.MEDIUM
              if (!Object.values(DifficultyLevel).includes(difficulty as DifficultyLevel)) {
                difficulty = DifficultyLevel.MEDIUM
                console.warn(`Invalid difficulty "${question.Difficulty}", defaulting to MEDIUM`)
              }

              // Parse points
              const points = parseFloat(question.Points) || 1.0
              if (isNaN(points) || points <= 0) {
                throw new Error(`Invalid points value for question "${question.Title}"`)
              }

              const questionData = {
                title: question.Title?.toString().trim() || "",
                content: question.Content?.toString().trim() || "",
                type: questionType,
                options: options,
                correctAnswer: correctAnswer,
                explanation: question.Explanation?.toString().trim() || "",
                difficulty: difficulty,
                points: points
              }

              console.log(`Sending question data for "${questionData.title}":`, questionData)

              const response = await fetch(`/api/admin/quiz/${quizId}/questions`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(questionData),
              })

              if (!response.ok) {
                const errorData = await response.json()
                console.error(`API error for question "${questionData.title}":`, errorData)
                throw new Error(errorData.message || `Failed to create question "${questionData.title}"`)
              }

              const result = await response.json()
              console.log(`Successfully imported question "${questionData.title}":`, result)
              return result
            } catch (error) {
              console.error(`Failed to import question "${question.Title}":`, error)
              return {
                error: true,
                title: question.Title,
                message: error instanceof Error ? error.message : "Unknown error"
              }
            }
          })

          const importResults = await Promise.all(importPromises)
          const successfulImports = importResults.filter(result => !result.error)
          const failedImports = importResults.filter(result => result.error)

          console.log(`Import results: ${successfulImports.length} successful, ${failedImports.length} failed`)

          if (successfulImports.length > 0) {
            toast.success(`Successfully imported ${successfulImports.length} question(s)`)
            fetchQuestions()
            fetchAvailableQuestions()
          }

          if (failedImports.length > 0) {
            const errorMessages = failedImports.map(failure =>
              `"${failure.title}": ${failure.message}`
            ).join('\n')
            console.error("Failed imports:", errorMessages)
            toast.error(`Failed to import ${failedImports.length} question(s):\n${errorMessages}`)
          }
        } catch (error) {
          console.error("Import error:", error)
          toast.error(`Failed to import questions: ${error instanceof Error ? error.message : "Unknown error"}`)
        }
      },
      error: (error) => {
        console.error("CSV parsing error:", error)
        toast.error(`Failed to parse CSV file: ${error.message}`)
      }
    })

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const filteredQuestions = questions.filter(question => {
    const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      question.content.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDifficulty = difficultyFilter === "all" || question.difficulty === difficultyFilter
    return matchesSearch && matchesDifficulty
  })

  const filteredAvailableQuestions = availableQuestions.filter(question => {
    const matchesSearch = question.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      question.content.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesDifficulty = difficultyFilter === "all" || question.difficulty === difficultyFilter
    const matchesGroup = groupFilter === "all" || question.group?.id === groupFilter
    return matchesSearch && matchesDifficulty && matchesGroup
  })

  if (loading) {
    return <div className="flex items-center justify-center h-[80vh] "><HexagonLoader size={80} /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search questions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 w-[300px]"
            />
          </div>
          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Difficulties</SelectItem>
              <SelectItem value="EASY">Easy</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="HARD">Hard</SelectItem>
            </SelectContent>
          </Select>
          <Select value={groupFilter} onValueChange={setGroupFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by group" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Groups</SelectItem>
              {questionGroups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name} ({group._count.questions})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Questions
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.back()}
            className="h-9"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Quiz Questions ({filteredQuestions.length})</CardTitle>
              <CardDescription>
                Questions currently assigned to this quiz. Drag to reorder.
              </CardDescription>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={handleExportQuestions}>
                <FileDown className="h-4 w-4 mr-2" />
                Export
              </Button>
              <Button variant="outline" size="sm" onClick={handleImportQuestions}>
                <FileUp className="h-4 w-4 mr-2" />
                Import
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]"></TableHead>
                  <TableHead className="w-[80px]">Order</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead className="w-[80px]">Points</TableHead>
                  <TableHead className="w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <SortableContext
                  items={filteredQuestions.map(q => q.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {filteredQuestions.map((question) => (
                    <SortableQuestion
                      key={question.id}
                      question={question}
                      onEdit={(question) => {
                        setSelectedQuestion(question)
                        setIsViewDialogOpen(true)
                      }}
                      onDelete={handleRemoveQuestion}
                      onView={(question) => {
                        setSelectedQuestion(question)
                        setIsViewDialogOpen(true)
                      }}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </CardContent>
      </Card>

      {/* Add Questions Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Add Questions</DialogTitle>
                <DialogDescription>
                  Select questions from the available pool to add to this quiz
                </DialogDescription>
              </div>
              <Button onClick={() => {
                setIsAddDialogOpen(false)
                setIsCreateDialogOpen(true)
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Button>
            </div>
          </DialogHeader>
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <div className="max-h-96 overflow-y-auto border rounded-md">
                {filteredAvailableQuestions.length > 0 ? (
                  filteredAvailableQuestions.map((question) => (
                    <div key={question.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 border-b last:border-b-0">
                      <input
                        type="checkbox"
                        id={`question-${question.id}`}
                        checked={selectedQuestionsToAdd.includes(question.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedQuestionsToAdd([...selectedQuestionsToAdd, question.id])
                          } else {
                            setSelectedQuestionsToAdd(selectedQuestionsToAdd.filter(id => id !== question.id))
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`question-${question.id}`} className="flex-1 cursor-pointer">
                        <div className="font-medium">{question.title}</div>
                        <div className="text-sm text-muted-foreground">{question.content}</div>
                        <div className="flex gap-2 mt-1">
                          <Badge variant={
                            question.type === QuestionType.MULTIPLE_CHOICE ? "default" :
                              question.type === QuestionType.MULTI_SELECT ? "secondary" :
                              question.type === QuestionType.TRUE_FALSE ? "outline" : "destructive"
                          }>
                            {question.type.replace('_', ' ')}
                          </Badge>
                          <Badge variant={
                            question.difficulty === DifficultyLevel.EASY ? "default" :
                              question.difficulty === DifficultyLevel.MEDIUM ? "secondary" : "destructive"
                          }>
                            {question.difficulty}
                          </Badge>
                          {question.group && (
                            <Badge variant="outline">
                              {question.group.name}
                            </Badge>
                          )}
                        </div>
                      </label>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No available questions found
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                handleAddQuestions(selectedQuestionsToAdd)
                setSelectedQuestionsToAdd([])
              }}
              disabled={selectedQuestionsToAdd.length === 0}
            >
              Add Selected ({selectedQuestionsToAdd.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Question Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Question Details</DialogTitle>
            <DialogDescription>
              View question details
            </DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            {selectedQuestion && (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Title</Label>
                  <p className="text-lg font-medium">{selectedQuestion.title}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Content</Label>
                  <p className="text-sm">{selectedQuestion.content}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Type</Label>
                  <Badge variant={
                    selectedQuestion.type === QuestionType.MULTIPLE_CHOICE ? "default" :
                      selectedQuestion.type === QuestionType.TRUE_FALSE ? "secondary" : "outline"
                  }>
                    {selectedQuestion.type.replace('_', ' ')}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Options</Label>
                  <div className="space-y-1">
                    {Array.isArray(selectedQuestion.options) ? (
                      selectedQuestion.options.map((option, index) => (
                        <div key={index} className="text-sm p-2 bg-muted rounded flex items-center gap-2">
                          {selectedQuestion.type === QuestionType.MULTI_SELECT && (
                            <Checkbox
                              checked={selectedQuestion.correctAnswer.split('|').includes(option)}
                              disabled
                            />
                          )}
                          {selectedQuestion.type === QuestionType.TRUE_FALSE && (
                            <Checkbox
                              checked={selectedQuestion.correctAnswer === option}
                              disabled
                            />
                          )}
                          {selectedQuestion.type === QuestionType.MULTIPLE_CHOICE && (
                            <Checkbox
                              checked={selectedQuestion.correctAnswer === option}
                              disabled
                            />
                          )}
                          {option}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm p-2 bg-muted rounded">
                        {selectedQuestion.options}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Correct Answer</Label>
                  <p className="text-sm font-medium text-green-600">{selectedQuestion.correctAnswer}</p>
                </div>
                {selectedQuestion.explanation && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Explanation</Label>
                    <p className="text-sm">{selectedQuestion.explanation}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Difficulty</Label>
                  <Badge variant={
                    selectedQuestion.difficulty === DifficultyLevel.EASY ? "default" :
                      selectedQuestion.difficulty === DifficultyLevel.MEDIUM ? "secondary" : "destructive"
                  }>
                    {selectedQuestion.difficulty}
                  </Badge>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">Points</Label>
                  <p className="text-sm">{selectedQuestion.points}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Question Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Question</DialogTitle>
            <DialogDescription>
              Create a new question and add it to this quiz
            </DialogDescription>
          </DialogHeader>
          <div className="grid flex-1 auto-rows-min gap-6 px-4">
            <div className="grid gap-3">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={createFormData.title}
                onChange={(e) => setCreateFormData({ ...createFormData, title: e.target.value })}
                placeholder="Enter question title"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="content">Content</Label>
              <RichTextEditor
                value={createFormData.content}
                onChange={(value) => setCreateFormData({ ...createFormData, content: value })}
                placeholder="Enter question content"
                className="min-h-[200px]"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="type">Type</Label>
              <Select
                value={createFormData.type.toString()}
                onValueChange={(value: string) => setCreateFormData({ ...createFormData, type: value as QuestionType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select question type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={QuestionType.MULTIPLE_CHOICE}>Multiple Choice</SelectItem>
                  <SelectItem value={QuestionType.MULTI_SELECT}>Multi-Select</SelectItem>
                  <SelectItem value={QuestionType.TRUE_FALSE}>True/False</SelectItem>
                  <SelectItem value={QuestionType.FILL_IN_BLANK}>Fill in the Blank</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3">
              <Label htmlFor="difficulty">Difficulty</Label>
              <Select
                value={createFormData.difficulty.toString()}
                onValueChange={(value: string) => setCreateFormData({ ...createFormData, difficulty: value as DifficultyLevel })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select difficulty" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={DifficultyLevel.EASY}>Easy</SelectItem>
                  <SelectItem value={DifficultyLevel.MEDIUM}>Medium</SelectItem>
                  <SelectItem value={DifficultyLevel.HARD}>Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createFormData.type !== QuestionType.FILL_IN_BLANK && (
              <div className="grid gap-3">
                <Label>Options</Label>
                <div className="space-y-2">
                  {createFormData.options.map((option, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...createFormData.options]
                          newOptions[index] = e.target.value
                          setCreateFormData({ ...createFormData, options: newOptions })
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="flex-1"
                      />
                      {createFormData.type === "MULTIPLE_CHOICE" && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newOptions = [...createFormData.options, ""]
                              setCreateFormData({ ...createFormData, options: newOptions })
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          {createFormData.options.length > 1 && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                const newOptions = createFormData.options.filter((_, i) => i !== index)
                                setCreateFormData({ ...createFormData, options: newOptions })
                              }}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="grid gap-3">
              <Label htmlFor="correctAnswer">Correct Answer</Label>
              <Input
                id="correctAnswer"
                value={createFormData.correctAnswer}
                onChange={(e) => setCreateFormData({ ...createFormData, correctAnswer: e.target.value })}
                placeholder="Enter correct answer"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="points">Points</Label>
              <Input
                id="points"
                type="number"
                value={createFormData.points}
                onChange={(e) => setCreateFormData({ ...createFormData, points: parseFloat(e.target.value) || 1.0 })}
                placeholder="1"
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="explanation">Explanation</Label>
              <RichTextEditor
                value={createFormData.explanation}
                onChange={(value) => setCreateFormData({ ...createFormData, explanation: value })}
                placeholder="Optional explanation for the answer"
                className="min-h-[150px]"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateQuestion}>
              Create and Add to Quiz
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}