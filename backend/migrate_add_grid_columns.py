"""
Migration script to add grid_columns and grid_rows to dashboards table.
Run this once to update existing database schema.
"""
import asyncio
from sqlalchemy import text
from database import engine

async def migrate():
    """Add grid_columns and grid_rows columns to dashboards table if they don't exist."""
    async with engine.begin() as conn:
        # Check if columns exist and add them if they don't
        try:
            # Add grid_columns column if it doesn't exist
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'dashboards' AND column_name = 'grid_columns'
                    ) THEN
                        ALTER TABLE dashboards ADD COLUMN grid_columns INTEGER DEFAULT 12;
                    END IF;
                END $$;
            """))
            print("✓ Added grid_columns column (or it already exists)")
            
            # Add grid_rows column if it doesn't exist
            await conn.execute(text("""
                DO $$ 
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'dashboards' AND column_name = 'grid_rows'
                    ) THEN
                        ALTER TABLE dashboards ADD COLUMN grid_rows INTEGER DEFAULT 10;
                    END IF;
                END $$;
            """))
            print("✓ Added grid_rows column (or it already exists)")
            
            print("\n✅ Migration completed successfully!")
            
        except Exception as e:
            print(f"❌ Migration failed: {e}")
            raise

if __name__ == "__main__":
    asyncio.run(migrate())
