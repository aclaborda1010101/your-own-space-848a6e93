import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ImportTransactionsDialogProps {
  onImport: (transactions: ParsedTransaction[]) => Promise<boolean | void>;
}

export interface ParsedTransaction {
  transaction_date: string;
  description: string;
  amount: number;
  transaction_type: "income" | "expense";
  category: string;
  vendor?: string;
  currency?: string;
}

// Revolut CSV columns: Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance
const parseRevolutCSV = (content: string): ParsedTransaction[] => {
  const lines = content.split("\n").filter(line => line.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].toLowerCase();
  const isRevolut = headers.includes("started date") || headers.includes("completed date");
  
  const transactions: ParsedTransaction[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 6) continue;
    
    try {
      if (isRevolut) {
        // Revolut format: Type, Product, Started Date, Completed Date, Description, Amount, Fee, Currency, State, Balance
        const [type, product, startedDate, completedDate, description, amountStr, fee, currency, state] = values;
        
        // Skip pending or failed transactions
        if (state && state.toLowerCase() !== "completed") continue;
        
        const amount = parseFloat(amountStr.replace(",", ".").replace(/[^\d.-]/g, ""));
        if (isNaN(amount) || amount === 0) continue;
        
        const dateStr = completedDate || startedDate;
        const parsedDate = parseDate(dateStr);
        if (!parsedDate) continue;
        
        transactions.push({
          transaction_date: parsedDate,
          description: description || type || "Transacción Revolut",
          amount: Math.abs(amount),
          transaction_type: amount >= 0 ? "income" : "expense",
          category: categorizeTransaction(description, type, product),
          vendor: extractVendor(description),
          currency: currency || "EUR"
        });
      } else {
        // Generic CSV format: Date, Description, Amount, [Category], [Currency]
        const [dateStr, description, amountStr, category, currency] = values;
        
        const amount = parseFloat(amountStr.replace(",", ".").replace(/[^\d.-]/g, ""));
        if (isNaN(amount) || amount === 0) continue;
        
        const parsedDate = parseDate(dateStr);
        if (!parsedDate) continue;
        
        transactions.push({
          transaction_date: parsedDate,
          description: description || "Transacción",
          amount: Math.abs(amount),
          transaction_type: amount >= 0 ? "income" : "expense",
          category: category || categorizeTransaction(description, "", ""),
          vendor: extractVendor(description),
          currency: currency || "EUR"
        });
      }
    } catch (e) {
      console.warn(`Error parsing line ${i}:`, e);
    }
  }
  
  return transactions;
};

const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  
  return result;
};

const parseDate = (dateStr: string): string | null => {
  if (!dateStr) return null;
  
  // Try various date formats
  const formats = [
    // ISO format: 2024-01-15
    /^(\d{4})-(\d{2})-(\d{2})/,
    // European format: 15/01/2024 or 15-01-2024
    /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/,
    // Revolut format: 15 Jan 2024 or Jan 15, 2024
    /^(\d{1,2})\s+(\w+)\s+(\d{4})/,
    /^(\w+)\s+(\d{1,2}),?\s+(\d{4})/,
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch {
        continue;
      }
    }
  }
  
  // Last resort: try direct parsing
  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  } catch {
    return null;
  }
  
  return null;
};

const categorizeTransaction = (description: string, type: string, product: string): string => {
  const desc = (description + " " + type + " " + product).toLowerCase();
  
  // Food & Restaurants
  if (/restaurant|cafe|coffee|starbucks|mcdonald|burger|pizza|uber\s*eats|glovo|deliveroo|just\s*eat/i.test(desc)) {
    return "food";
  }
  
  // Transportation
  if (/uber|taxi|cabify|renfe|metro|bus|gasolina|fuel|parking|shell|repsol|cepsa/i.test(desc)) {
    return "transport";
  }
  
  // Shopping
  if (/amazon|zara|hm|primark|el\s*corte|mercadona|carrefour|lidl|aldi|dia\s/i.test(desc)) {
    return "shopping";
  }
  
  // Entertainment
  if (/netflix|spotify|hbo|disney|cine|cinema|steam|playstation|xbox|game/i.test(desc)) {
    return "entertainment";
  }
  
  // Utilities
  if (/iberdrola|endesa|naturgy|vodafone|movistar|orange|agua|water|gas|electric/i.test(desc)) {
    return "utilities";
  }
  
  // Health
  if (/farmacia|pharmacy|hospital|medic|doctor|dentist|gym|fitness/i.test(desc)) {
    return "health";
  }
  
  // Transfers
  if (/transfer|bizum|paypal|to\s+[a-z]/i.test(desc) || type?.toLowerCase().includes("transfer")) {
    return "transfer";
  }
  
  // Income patterns
  if (/salary|nomina|payroll|income|ingreso/i.test(desc)) {
    return "salary";
  }
  
  return "other";
};

const extractVendor = (description: string): string | undefined => {
  // Try to extract merchant name from common patterns
  const patterns = [
    /^([\w\s]+)\s+-\s+/,  // "Merchant - description"
    /^([\w\s]+)\s+\*/,    // "Merchant * reference"
    /^([\w\s]+)$/,        // Just the merchant name
  ];
  
  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match && match[1]) {
      const vendor = match[1].trim();
      if (vendor.length > 2 && vendor.length < 50) {
        return vendor;
      }
    }
  }
  
  return undefined;
};

export function ImportTransactionsDialog({ onImport }: ImportTransactionsDialogProps) {
  const [open, setOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string>("");

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv")) {
      toast.error("Por favor, sube un archivo CSV");
      return;
    }
    
    setFileName(file.name);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      try {
        const transactions = parseRevolutCSV(content);
        if (transactions.length === 0) {
          toast.error("No se encontraron transacciones válidas en el archivo");
          return;
        }
        setParsedTransactions(transactions);
        toast.success(`${transactions.length} transacciones encontradas`);
      } catch (error) {
        console.error("Error parsing CSV:", error);
        toast.error("Error al procesar el archivo CSV");
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleImport = async () => {
    if (parsedTransactions.length === 0) return;
    
    setImporting(true);
    try {
      await onImport(parsedTransactions);
      toast.success(`${parsedTransactions.length} transacciones importadas`);
      setParsedTransactions([]);
      setFileName("");
      setOpen(false);
    } catch (error) {
      console.error("Error importing transactions:", error);
      toast.error("Error al importar transacciones");
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setParsedTransactions([]);
    setFileName("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="h-4 w-4 mr-2" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Importar Transacciones</DialogTitle>
          <DialogDescription>
            Sube un archivo CSV exportado desde Revolut u otro banco
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Instructions */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <strong>Cómo exportar desde Revolut:</strong>
              <ol className="list-decimal ml-4 mt-2 text-sm space-y-1">
                <li>Abre la app Revolut → Transacciones</li>
                <li>Toca los 3 puntos (⋮) → Exportar</li>
                <li>Selecciona el período y formato CSV</li>
                <li>Sube el archivo aquí</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging 
                ? "border-primary bg-primary/5" 
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
              id="csv-upload"
            />
            <label htmlFor="csv-upload" className="cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Arrastra un archivo CSV aquí o <span className="text-primary underline">selecciona uno</span>
              </p>
            </label>
          </div>

          {/* Preview */}
          {parsedTransactions.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">{fileName}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  Cambiar archivo
                </Button>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                <p className="text-sm font-medium">Vista previa ({parsedTransactions.length} transacciones):</p>
                <div className="space-y-1">
                  {parsedTransactions.slice(0, 5).map((t, i) => (
                    <div key={i} className="flex justify-between text-xs">
                      <span className="truncate flex-1">{t.description}</span>
                      <span className={t.transaction_type === "income" ? "text-green-600" : "text-red-600"}>
                        {t.transaction_type === "income" ? "+" : "-"}{t.amount.toFixed(2)}€
                      </span>
                    </div>
                  ))}
                  {parsedTransactions.length > 5 && (
                    <p className="text-xs text-muted-foreground">
                      ... y {parsedTransactions.length - 5} más
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  className="flex-1" 
                  onClick={handleImport} 
                  disabled={importing}
                >
                  {importing ? "Importando..." : `Importar ${parsedTransactions.length} transacciones`}
                </Button>
              </div>
            </div>
          )}

          {/* Supported formats */}
          <p className="text-xs text-muted-foreground text-center">
            Formatos soportados: Revolut, N26, BBVA, La Caixa, Santander (CSV)
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
