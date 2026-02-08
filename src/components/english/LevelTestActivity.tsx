import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Award, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface Question {
  id: number;
  level: string;
  question: string;
  options: string[];
  correct: number;
  points: number;
}

const LEVEL_TEST_QUESTIONS: Question[] = [
  // A1 Level (1-5)
  {
    id: 1,
    level: "A1",
    question: "Hello! My name ___ Maria.",
    options: ["am", "is", "are", "be"],
    correct: 1,
    points: 1
  },
  {
    id: 2,
    level: "A1",
    question: "I ___ from Spain.",
    options: ["am", "is", "are", "be"],
    correct: 0,
    points: 1
  },
  {
    id: 3,
    level: "A1",
    question: "She ___ a teacher.",
    options: ["am", "is", "are", "be"],
    correct: 1,
    points: 1
  },
  {
    id: 4,
    level: "A1",
    question: "Do you ___ coffee?",
    options: ["like", "likes", "liking", "to like"],
    correct: 0,
    points: 1
  },
  {
    id: 5,
    level: "A1",
    question: "There ___ two cats in the garden.",
    options: ["is", "are", "am", "be"],
    correct: 1,
    points: 1
  },
  
  // A2 Level (6-10)
  {
    id: 6,
    level: "A2",
    question: "I ___ to the cinema yesterday.",
    options: ["go", "goes", "went", "going"],
    correct: 2,
    points: 2
  },
  {
    id: 7,
    level: "A2",
    question: "She has ___ in London for three years.",
    options: ["live", "lived", "living", "been living"],
    correct: 3,
    points: 2
  },
  {
    id: 8,
    level: "A2",
    question: "If it rains tomorrow, I ___ at home.",
    options: ["stay", "will stay", "stayed", "am staying"],
    correct: 1,
    points: 2
  },
  {
    id: 9,
    level: "A2",
    question: "This book is ___ than that one.",
    options: ["good", "better", "best", "more good"],
    correct: 1,
    points: 2
  },
  {
    id: 10,
    level: "A2",
    question: "I don't have ___ money with me.",
    options: ["some", "any", "many", "few"],
    correct: 1,
    points: 2
  },

  // B1 Level (11-15)
  {
    id: 11,
    level: "B1",
    question: "By the time you arrive, I ___ dinner.",
    options: ["finish", "will finish", "will have finished", "am finishing"],
    correct: 2,
    points: 3
  },
  {
    id: 12,
    level: "B1",
    question: "She suggested ___ to the new restaurant.",
    options: ["to go", "going", "go", "gone"],
    correct: 1,
    points: 3
  },
  {
    id: 13,
    level: "B1",
    question: "I wish I ___ more time to study.",
    options: ["have", "had", "has", "having"],
    correct: 1,
    points: 3
  },
  {
    id: 14,
    level: "B1",
    question: "The project ___ by the team last month.",
    options: ["completes", "completed", "was completed", "has completed"],
    correct: 2,
    points: 3
  },
  {
    id: 15,
    level: "B1",
    question: "Despite ___ tired, she continued working.",
    options: ["be", "being", "to be", "been"],
    correct: 1,
    points: 3
  },

  // B2 Level (16-20)
  {
    id: 16,
    level: "B2",
    question: "Had I known about the traffic, I ___ earlier.",
    options: ["leave", "left", "would leave", "would have left"],
    correct: 3,
    points: 4
  },
  {
    id: 17,
    level: "B2",
    question: "The report needs ___ before the meeting.",
    options: ["revise", "revising", "to be revised", "revised"],
    correct: 2,
    points: 4
  },
  {
    id: 18,
    level: "B2",
    question: "Scarcely ___ the door when the phone rang.",
    options: ["I had opened", "had I opened", "I opened", "did I open"],
    correct: 1,
    points: 4
  },
  {
    id: 19,
    level: "B2",
    question: "She's not used ___ up so early.",
    options: ["to get", "to getting", "get", "getting"],
    correct: 1,
    points: 4
  },
  {
    id: 20,
    level: "B2",
    question: "The more you practice, ___ you'll become.",
    options: ["the better", "better", "the best", "best"],
    correct: 0,
    points: 4
  },

  // C1 Level (21-25)
  {
    id: 21,
    level: "C1",
    question: "Not only ___ the exam, but he also got the highest score.",
    options: ["he passed", "did he pass", "he did pass", "passed he"],
    correct: 1,
    points: 5
  },
  {
    id: 22,
    level: "C1",
    question: "The proposal ___ consideration by the board next week.",
    options: ["will be given", "will give", "is giving", "gives"],
    correct: 0,
    points: 5
  },
  {
    id: 23,
    level: "C1",
    question: "Were it not for your help, I ___ the project on time.",
    options: ["wouldn't complete", "wouldn't have completed", "won't complete", "hadn't completed"],
    correct: 1,
    points: 5
  },
  {
    id: 24,
    level: "C1",
    question: "The findings are ___ with previous research in the field.",
    options: ["coherent", "consistent", "compatible", "correspondent"],
    correct: 1,
    points: 5
  },
  {
    id: 25,
    level: "C1",
    question: "He's known for his ___ approach to problem-solving.",
    options: ["methodical", "methodic", "methodically", "method"],
    correct: 0,
    points: 5
  },

  // C2 Level (26-30)
  {
    id: 26,
    level: "C2",
    question: "The committee's decision was ___; there were no dissenting voices.",
    options: ["unanimous", "anonymous", "ambiguous", "ubiquitous"],
    correct: 0,
    points: 6
  },
  {
    id: 27,
    level: "C2",
    question: "His argument, ___ persuasive, failed to convince the jury.",
    options: ["however", "although", "despite", "whilst"],
    correct: 0,
    points: 6
  },
  {
    id: 28,
    level: "C2",
    question: "The data ___ a significant correlation between the variables.",
    options: ["evince", "evinces", "evincing", "evinced"],
    correct: 1,
    points: 6
  },
  {
    id: 29,
    level: "C2",
    question: "The politician's speech was characterized by its ___ rhetoric.",
    options: ["grandiloquent", "grandiose", "gratuitous", "gregarious"],
    correct: 0,
    points: 6
  },
  {
    id: 30,
    level: "C2",
    question: "Little ___ that this decision would change everything.",
    options: ["he knew", "did he know", "he did know", "knew he"],
    correct: 1,
    points: 6
  },
];

const LEVEL_THRESHOLDS = {
  A1: { min: 0, max: 5 },
  A2: { min: 6, max: 15 },
  B1: { min: 16, max: 30 },
  B2: { min: 31, max: 50 },
  C1: { min: 51, max: 75 },
  C2: { min: 76, max: 100 },
};

function calculateLevel(score: number): { level: string; description: string } {
  if (score <= LEVEL_THRESHOLDS.A1.max) return { 
    level: "A1", 
    description: "Beginner - Puedes usar frases básicas y vocabulario simple" 
  };
  if (score <= LEVEL_THRESHOLDS.A2.max) return { 
    level: "A2", 
    description: "Elementary - Puedes comunicarte en situaciones cotidianas" 
  };
  if (score <= LEVEL_THRESHOLDS.B1.max) return { 
    level: "B1", 
    description: "Intermediate - Puedes manejar conversaciones sobre temas familiares" 
  };
  if (score <= LEVEL_THRESHOLDS.B2.max) return { 
    level: "B2", 
    description: "Upper Intermediate - Puedes interactuar con fluidez en la mayoría de situaciones" 
  };
  if (score <= LEVEL_THRESHOLDS.C1.max) return { 
    level: "C1", 
    description: "Advanced - Puedes usar el idioma de forma flexible y efectiva" 
  };
  return { 
    level: "C2", 
    description: "Proficiency - Dominio casi nativo del idioma" 
  };
}

export function LevelTestActivity({ onComplete }: { onComplete?: () => void }) {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>(Array(LEVEL_TEST_QUESTIONS.length).fill(null));
  const [showResults, setShowResults] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const question = LEVEL_TEST_QUESTIONS[currentQuestion];
  const progress = ((currentQuestion + 1) / LEVEL_TEST_QUESTIONS.length) * 100;

  const handleStart = () => {
    setIsStarted(true);
    setCurrentQuestion(0);
    setAnswers(Array(LEVEL_TEST_QUESTIONS.length).fill(null));
    setShowResults(false);
  };

  const handleAnswer = () => {
    if (selectedAnswer === null) {
      toast.error("Por favor selecciona una respuesta");
      return;
    }

    const newAnswers = [...answers];
    newAnswers[currentQuestion] = selectedAnswer;
    setAnswers(newAnswers);

    if (currentQuestion < LEVEL_TEST_QUESTIONS.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      setShowResults(true);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer(answers[currentQuestion - 1]);
    }
  };

  const calculateResults = () => {
    let totalScore = 0;
    let correctAnswers = 0;

    answers.forEach((answer, index) => {
      if (answer === LEVEL_TEST_QUESTIONS[index].correct) {
        totalScore += LEVEL_TEST_QUESTIONS[index].points;
        correctAnswers++;
      }
    });

    const { level, description } = calculateLevel(totalScore);

    return {
      totalScore,
      correctAnswers,
      totalQuestions: LEVEL_TEST_QUESTIONS.length,
      level,
      description,
    };
  };

  if (!isStarted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-6 w-6 text-blue-500" />
            Test de Nivel CEFR
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Evalúa tu nivel de inglés según el Marco Común Europeo de Referencia (CEFR).
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <Badge variant="outline" className="justify-center py-2">A1 - Beginner</Badge>
              <Badge variant="outline" className="justify-center py-2">A2 - Elementary</Badge>
              <Badge variant="outline" className="justify-center py-2">B1 - Intermediate</Badge>
              <Badge variant="outline" className="justify-center py-2">B2 - Upper Int.</Badge>
              <Badge variant="outline" className="justify-center py-2">C1 - Advanced</Badge>
              <Badge variant="outline" className="justify-center py-2">C2 - Proficiency</Badge>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="text-sm font-medium">ℹ️ Instrucciones:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>30 preguntas de gramática y vocabulario</li>
                <li>Progresión de A1 a C2</li>
                <li>Sin límite de tiempo</li>
                <li>Resultado inmediato al finalizar</li>
              </ul>
            </div>
          </div>

          <Button onClick={handleStart} className="w-full">
            Comenzar Test
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (showResults) {
    const results = calculateResults();

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-6 w-6 text-green-500" />
            Resultados del Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-green-100 dark:bg-green-900">
              <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                {results.level}
              </span>
            </div>

            <div>
              <h3 className="text-2xl font-bold">{results.description}</h3>
              <p className="text-sm text-muted-foreground mt-2">
                {results.correctAnswers} de {results.totalQuestions} respuestas correctas
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm font-medium mb-2">Puntuación Total</p>
              <p className="text-3xl font-bold">{results.totalScore} puntos</p>
            </div>

            <div className="space-y-2 text-left">
              <p className="text-sm font-medium">Desglose por nivel:</p>
              {Object.entries(LEVEL_THRESHOLDS).map(([level, threshold]) => {
                const levelQuestions = LEVEL_TEST_QUESTIONS.filter(q => q.level === level);
                const correctInLevel = levelQuestions.filter((q, idx) => 
                  answers[LEVEL_TEST_QUESTIONS.indexOf(q)] === q.correct
                ).length;

                return (
                  <div key={level} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{level}:</span>
                    <span className="text-muted-foreground">
                      {correctInLevel}/{levelQuestions.length}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleStart} variant="outline" className="flex-1">
              Repetir Test
            </Button>
            <Button 
              onClick={() => {
                onComplete?.();
                toast.success("Test completado y guardado");
              }} 
              className="flex-1"
            >
              Finalizar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">
              Pregunta {currentQuestion + 1} de {LEVEL_TEST_QUESTIONS.length}
            </CardTitle>
            <Badge>{question.level}</Badge>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <p className="text-lg font-medium">{question.question}</p>

          <RadioGroup value={selectedAnswer?.toString()} onValueChange={(value) => setSelectedAnswer(Number(value))}>
            <div className="space-y-2">
              {question.options.map((option, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="cursor-pointer flex-1 p-3 rounded-lg border hover:bg-muted">
                    {option}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={handlePrevious} 
            disabled={currentQuestion === 0}
            variant="outline"
            className="flex-1"
          >
            Anterior
          </Button>
          <Button 
            onClick={handleAnswer} 
            disabled={selectedAnswer === null}
            className="flex-1"
          >
            {currentQuestion === LEVEL_TEST_QUESTIONS.length - 1 ? "Finalizar" : "Siguiente"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
