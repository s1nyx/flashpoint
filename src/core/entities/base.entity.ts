/**
 * @class Entity
 * @description Base class for all domain entities
 * Implements common entity behavior and validation
 */
export abstract class Entity {
    protected id: string;
    protected createdAt: Date;
    protected updatedAt: Date;
  
    constructor(id: string) {
      this.id = id;
      this.createdAt = new Date();
      this.updatedAt = new Date();
    }
  
    public getId(): string {
      return this.id;
    }
  
    protected update(): void {
      this.updatedAt = new Date();
    }
  
    public abstract validate(): boolean;
  }