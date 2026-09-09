import type {
  Category,
  ItemWithOptions,
  Project,
  ProjectPriorityOption,
  ProjectStatusOption,
} from '@/types/domain'

export type IssueSeverity = 'ok' | 'warning' | 'error'

export type IssueCode =
  | 'empty_row'
  | 'empty_name'
  | 'unknown_status'
  | 'invalid_estimated_cost'
  | 'invalid_planned_price'
  | 'invalid_actual_cost'
  | 'invalid_date'
  | 'purchased_without_actual'
  | 'unknown_category'
  | 'unknown_priority'
  | 'possible_duplicate'

export type ImportIssue = {
  code: IssueCode
  severity: IssueSeverity
  message: string
}

export type DuplicateAction = 'omit' | 'create_new' | 'update_existing'

export type FieldDiffKind = 'change' | 'add_option' | 'protected'

export type FieldDiff = {
  field: string
  label: string
  kind: FieldDiffKind
  from: string
  to: string
}

export type DraftOption = {
  name: string
  price: number | null
  store: string | null
  product_url: string | null
}

export type MappedDraft = {
  rowIndex: number
  name: string
  categoryName: string | null
  priorityRaw: string | null
  statusRaw: string | null
  estimatedCost: number | null
  plannedPrice: number | null
  actualCost: number | null
  store: string | null
  notes: string | null
  purchaseUrl: string | null
  completedAt: string | null
  option: DraftOption | null
  /** Parsed numbers that failed validation stay as NaN markers via flags */
  estimatedCostInvalid: boolean
  plannedPriceInvalid: boolean
  actualCostInvalid: boolean
  dateInvalid: boolean
  empty: boolean
}

export type ResolvedCategory =
  | { kind: 'existing'; id: string; name: string }
  | { kind: 'create'; name: string }
  | { kind: 'none' }

export type ResolvedPriority =
  | { kind: 'existing'; id: string; label: string }
  | { kind: 'create'; id: string; label: string }
  | { kind: 'default'; id: string; label: string }

export type ResolvedStatus =
  | { kind: 'ok'; id: string; label: string; behavior: string }
  | { kind: 'unknown'; raw: string }
  | { kind: 'default'; id: string; label: string; behavior: string }

export type PreviewRow = {
  id: string
  draft: MappedDraft
  category: ResolvedCategory
  priority: ResolvedPriority
  status: ResolvedStatus
  issues: ImportIssue[]
  severity: IssueSeverity
  selected: boolean
  duplicateAction: DuplicateAction | null
  matchedItemId: string | null
  matchedItemName: string | null
  updateDiff: FieldDiff[]
}

export type ImportDestination =
  | {
      mode: 'new'
      name: string
      budget: number | null
    }
  | {
      mode: 'existing'
      projectId: string
    }

export type ImportTargetContext = {
  project: Project | null
  categories: Category[]
  items: ItemWithOptions[]
  statusOptions: ProjectStatusOption[]
  priorityOptions: ProjectPriorityOption[]
}

export type ImportCommitSummary = {
  /** itemsCreated + itemsUpdated */
  itemsImported: number
  itemsCreated: number
  itemsUpdated: number
  itemsOmitted: number
  categoriesCreated: number
  prioritiesCreated: number
  optionsCreated: number
  warningRows: number
  errorRows: number
}

export type ImportCommitResult = {
  projectId: string
  summary: ImportCommitSummary
}
