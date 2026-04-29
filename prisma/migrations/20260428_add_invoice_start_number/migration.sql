-- Add invoiceStartNumber to clients table
ALTER TABLE Client ADD COLUMN invoiceStartNumber INTEGER NOT NULL DEFAULT 1;