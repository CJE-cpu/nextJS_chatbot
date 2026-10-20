export type Studymode = "explain" | "quiz" | "hint"

export type StudyItem = {
    id : number
    title : string
    description : string
    mode : Studymode
}

export type AiRequest = {
    message : string
    mode : Studymode
}

export type AiResponse = {
    answer : string
    question : string
    questionAns : string
    hint : string
}