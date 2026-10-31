# SubFlow — Entity Relationship Diagram

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string name
        string passwordHash
        Role role
        boolean isActive
        boolean forcePasswordChange
        datetime createdAt
        datetime updatedAt
    }

    CustomerProfile {
        string id PK
        string userId FK UK
        string company
        string phone
        string addressLine1
        string city
        string state
        string pincode
        string gstin
    }

    RefreshToken {
        string id PK
        string userId FK
        string tokenHash UK
        string family
        datetime expiresAt
        datetime revokedAt
    }

    PasswordResetToken {
        string id PK
        string userId FK
        string tokenHash UK
        datetime expiresAt
        datetime usedAt
    }

    Product {
        string id PK
        string name
        ProductType type
        decimal salesPrice
        decimal costPrice
        string notes
        boolean isActive
        string defaultTaxId FK
    }

    ProductVariant {
        string id PK
        string productId FK
        string attributeName
        string attributeValue
        decimal extraPrice
        boolean isActive
    }

    Tax {
        string id PK
        string name
        TaxType type
        decimal rate
        boolean isActive
    }

    Plan {
        string id PK
        string name
        decimal price
        BillingPeriod billingPeriod
        int minQuantity
        date availableFrom
        date availableTo
        boolean isActive
        boolean autoClose
        boolean closable
        boolean pausable
        boolean renewable
    }

    QuotationTemplate {
        string id PK
        string name
        string planId FK
        int validityDays
        boolean isActive
    }

    QuotationTemplateLine {
        string id PK
        string templateId FK
        string productId FK
        string variantId FK
        int quantity
    }

    SequenceCounter {
        string id PK
        string name UK
        int lastValue
    }

    Subscription {
        string id PK
        string number UK
        string customerId FK
        string planId FK
        date startDate
        date expiryDate
        PaymentTerms paymentTerms
        date nextBillingDate
        SubscriptionStatus status
        string createdById FK
        string notes
        date quoteExpiryDate
    }

    SubscriptionLine {
        string id PK
        string subscriptionId FK
        string productId FK
        string variantId FK
        string taxId FK
        int quantity
        decimal unitPrice
        decimal lineAmount
    }

    Invoice {
        string id PK
        string number UK
        string subscriptionId FK
        string customerId FK
        string snapshotCustomerName
        string snapshotCustomerEmail
        date billingPeriodStart
        date billingPeriodEnd
        date issueDate
        date dueDate
        decimal subtotal
        decimal discountTotal
        decimal taxTotal
        decimal grandTotal
        decimal amountPaid
        InvoiceStatus status
        datetime reminderSentAt
    }

    InvoiceLine {
        string id PK
        string invoiceId FK
        string productId FK
        string variantId FK
        string taxId FK
        string productName
        string variantLabel
        int quantity
        decimal unitPrice
        decimal discount
        decimal taxRate
        decimal taxAmount
        decimal lineTotal
    }

    Discount {
        string id PK
        string name
        DiscountType type
        decimal value
        decimal minPurchaseAmount
        int minQuantity
        date startDate
        date endDate
        int usageLimit
        int usedCount
        DiscountScope scope
        boolean isActive
    }

    DiscountProduct {
        string id PK
        string discountId FK
        string productId FK
    }

    DiscountRedemption {
        string id PK
        string discountId FK
        string invoiceId FK
        decimal amount
    }

    Payment {
        string id PK
        string invoiceId FK
        PaymentMethod method
        decimal amount
        date paymentDate
        string note
        string referenceNumber
        string recordedById FK
    }

    BillingRun {
        string id PK
        string triggeredBy
        boolean isDryRun
        datetime startedAt
        datetime completedAt
        int processed
        int created
        int skipped
        int failed
        json errors
    }

    AuditLog {
        string id PK
        string entityType
        string entityId
        string action
        string fromStatus
        string toStatus
        string userId FK
        json metadata
        datetime createdAt
    }

    User ||--o| CustomerProfile : "has"
    User ||--o{ RefreshToken : "owns"
    User ||--o{ PasswordResetToken : "owns"
    User ||--o{ AuditLog : "performs"
    User ||--o{ Payment : "records"
    User ||--o{ Subscription : "creates"

    CustomerProfile ||--o{ Subscription : "has"
    CustomerProfile ||--o{ Invoice : "has"

    Product ||--o| Tax : "default tax"
    Product ||--o{ ProductVariant : "has"
    Product ||--o{ SubscriptionLine : "in"
    Product ||--o{ InvoiceLine : "in"
    Product ||--o{ DiscountProduct : "in"
    Product ||--o{ QuotationTemplateLine : "in"

    ProductVariant ||--o{ SubscriptionLine : "in"
    ProductVariant ||--o{ InvoiceLine : "in"
    ProductVariant ||--o{ QuotationTemplateLine : "in"

    Tax ||--o{ SubscriptionLine : "applied to"
    Tax ||--o{ InvoiceLine : "applied to"

    Plan ||--o{ Subscription : "governs"
    Plan ||--o{ QuotationTemplate : "used in"

    QuotationTemplate ||--o{ QuotationTemplateLine : "has"

    Subscription ||--o{ SubscriptionLine : "has"
    Subscription ||--o{ Invoice : "generates"

    Invoice ||--o{ InvoiceLine : "has"
    Invoice ||--o{ Payment : "receives"
    Invoice ||--o{ DiscountRedemption : "has"

    Discount ||--o{ DiscountProduct : "scoped to"
    Discount ||--o{ DiscountRedemption : "redeemed in"
```

## Key Relationships

| Relationship | Type | Notes |
|---|---|---|
| User → CustomerProfile | 1:1 | Only CUSTOMER role users have a profile |
| Subscription → Invoice | 1:many | Each billing period creates one invoice |
| Invoice → Payment | 1:many | Supports partial payments |
| Discount → DiscountRedemption | 1:many | One per invoice, atomic usage tracking |
| AuditLog | Polymorphic | `entityType` + `entityId` — tracks all entity changes |

## Unique Constraints (Idempotency)

| Table | Constraint | Purpose |
|---|---|---|
| `invoices` | `(subscriptionId, billingPeriodStart)` | Prevent duplicate billing |
| `discount_redemptions` | `(discountId, invoiceId)` | One discount per invoice |
| `discount_products` | `(discountId, productId)` | No duplicate product mappings |
| `users` | `email` | Case-insensitive unique email |
| `sequence_counters` | `name` | One counter per sequence name |
