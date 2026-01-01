import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ShoppingCart, 
  Plus, 
  Trash2, 
  Loader2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useShoppingList, ShoppingItem } from "@/hooks/useShoppingList";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  'Carnes': 'bg-destructive/10 text-destructive',
  'Pescados': 'bg-primary/10 text-primary',
  'Lácteos': 'bg-warning/10 text-warning',
  'Verduras': 'bg-success/10 text-success',
  'Frutas': 'bg-chart-4/10 text-chart-4',
  'Cereales': 'bg-chart-5/10 text-chart-5',
  'Condimentos': 'bg-muted text-muted-foreground',
  'Otros': 'bg-secondary text-secondary-foreground',
};

export const ShoppingListCard = () => {
  const { currentList, loading, toggleItem, addItem, removeItem, clearList } = useShoppingList();
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Carnes', 'Verduras', 'Otros']));

  const handleAddItem = () => {
    if (!newItemName.trim()) return;
    addItem({
      name: newItemName.trim(),
      quantity: newItemQuantity.trim() || '1',
      category: 'Otros',
    });
    setNewItemName('');
    setNewItemQuantity('');
  };

  const toggleCategory = (category: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else {
        next.add(category);
      }
      return next;
    });
  };

  const groupedItems = (currentList?.items || []).reduce((acc, item, index) => {
    const category = item.category || 'Otros';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push({ ...item, originalIndex: index });
    return acc;
  }, {} as Record<string, (ShoppingItem & { originalIndex: number })[]>);

  const totalItems = currentList?.items?.length || 0;
  const checkedItems = currentList?.items?.filter((i) => i.checked).length || 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-primary" />
          Lista de Compra
          {totalItems > 0 && (
            <Badge variant="secondary" className="ml-2">
              {checkedItems}/{totalItems}
            </Badge>
          )}
        </CardTitle>
        {currentList && (
          <Button variant="ghost" size="icon" onClick={clearList} className="h-8 w-8">
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add item form */}
        <div className="flex gap-2">
          <Input
            placeholder="Añadir artículo..."
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
            className="flex-1"
          />
          <Input
            placeholder="Cantidad"
            value={newItemQuantity}
            onChange={(e) => setNewItemQuantity(e.target.value)}
            className="w-24"
          />
          <Button size="icon" onClick={handleAddItem}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Items list */}
        {totalItems === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay artículos en la lista</p>
            <p className="text-xs mt-1">Genera una lista desde tus comidas seleccionadas</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-3">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="flex items-center gap-2 w-full text-left py-1"
                  >
                    {expandedCategories.has(category) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    <Badge className={cn("font-normal", CATEGORY_COLORS[category] || CATEGORY_COLORS['Otros'])}>
                      {category} ({items.length})
                    </Badge>
                  </button>
                  
                  {expandedCategories.has(category) && (
                    <div className="ml-6 space-y-1 mt-1">
                      {items.map((item) => (
                        <div
                          key={item.originalIndex}
                          className="flex items-center gap-2 py-1 group"
                        >
                          <Checkbox
                            checked={item.checked}
                            onCheckedChange={() => toggleItem(item.originalIndex)}
                          />
                          <span className={cn(
                            "flex-1 text-sm",
                            item.checked && "line-through text-muted-foreground"
                          )}>
                            {item.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {item.quantity}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => removeItem(item.originalIndex)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};
